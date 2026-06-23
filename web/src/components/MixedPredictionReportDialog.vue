<script setup lang="ts">
import { computed } from "vue";
import bayesianMarkovScoreJson from "../data/bayesian-markov-score.json";
import predictiveScoreGridJson from "../data/predictive-score-grid.json";
import { buildCoOccurrenceModel } from "../lib/coOccurrence";
import { buildCurrentCombinedPredictionRows } from "../lib/combinedPrediction";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type {
  BayesianMarkovModel,
  BayesianMarkovPrediction,
  EnrichedDraw,
  EnrichedHistory,
  FreshnessModel,
  PredictiveScoreGrid,
  ProximityModel,
  WorkspaceTab,
  WorkspaceView,
} from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  freshnessModel: FreshnessModel;
  history: EnrichedHistory;
  maxReferenceDrawOffset: number;
  nextActualDraw: EnrichedDraw | null;
  proximityModel: ProximityModel;
  referenceDrawOffset: number;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  closeWorkspaceView: [value: WorkspaceView];
  firstReferenceDraw: [];
  latestReferenceDraw: [];
  nextReferenceDraw: [];
  previousReferenceDraw: [];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const bayesianMarkovModel = bayesianMarkovScoreJson as BayesianMarkovModel;
const predictiveScoreGrid = predictiveScoreGridJson as PredictiveScoreGrid;
const coOccurrenceModel = computed(() => buildCoOccurrenceModel(props.history));
const referenceDate = computed(() => props.history.draws[props.history.draws.length - 1]?.date ?? null);
const hitNumbers = computed(
  () => new Set(props.nextActualDraw?.numbers.map((number) => number.value) ?? []),
);
const bayesianBucketByGap = new Map(
  bayesianMarkovModel.bucketSummaries.map((summary) => [summary.bucket, summary]),
);

const bands = [
  { id: "elite", label: "Elite", color: "#0a562c", description: "Mixed score from 80 to 100." },
  { id: "strong", label: "Strong", color: "#47b25c", description: "Mixed score from 60 to 79.99." },
  { id: "active", label: "Active", color: "#f0b44f", description: "Mixed score from 40 to 59.99." },
  { id: "soft", label: "Soft", color: "#7b8798", description: "Mixed score below 40." },
];

function score(value: number): string {
  return value.toFixed(1);
}

function rankLabel(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function gapBucket(gap: number): number {
  return Math.min(Math.max(gap, 0), bayesianMarkovModel.maxGapBucket);
}

function bandForScore(scoreValue: number): { id: string; label: string } {
  if (scoreValue >= 80) {
    return { id: "elite", label: "Elite" };
  }

  if (scoreValue >= 60) {
    return { id: "strong", label: "Strong" };
  }

  if (scoreValue >= 40) {
    return { id: "active", label: "Active" };
  }

  return { id: "soft", label: "Soft" };
}

function bandColor(scoreValue: number): string {
  const band = bandForScore(scoreValue);

  return bands.find((candidate) => candidate.id === band.id)?.color ?? "#7b8798";
}

function scaleScores(values: Map<number, number>): Map<number, number> {
  const rawValues = [...values.values()];
  const minValue = Math.min(...rawValues);
  const maxValue = Math.max(...rawValues);
  const spread = maxValue - minValue;

  if (spread <= 0) {
    return new Map([...values.keys()].map((key) => [key, 0]));
  }

  return new Map(
    [...values.entries()].map(([key, value]) => [key, ((value - minValue) / spread) * 100]),
  );
}

const bayesianCurrentGaps = computed(() => {
  const lastSeen = new Map<number, number | null>();

  for (let number = 1; number <= bayesianMarkovModel.numberCount; number += 1) {
    lastSeen.set(number, null);
  }

  props.history.draws.forEach((draw, drawIndex) => {
    for (const number of draw.numbers) {
      lastSeen.set(number.value, drawIndex);
    }
  });

  const drawCount = props.history.draws.length;

  return new Map(
    Array.from({ length: bayesianMarkovModel.numberCount }, (_value, index) => {
      const number = index + 1;
      const seenAt = lastSeen.get(number) ?? null;

      return [number, seenAt === null ? drawCount : drawCount - 1 - seenAt];
    }),
  );
});

const bayesianPredictions = computed<BayesianMarkovPrediction[]>(() => {
  const posteriorMeans = new Map(
    Array.from({ length: bayesianMarkovModel.numberCount }, (_value, index) => {
      const number = index + 1;
      const bucket = gapBucket(bayesianCurrentGaps.value.get(number) ?? 0);
      const summary = bayesianBucketByGap.get(bucket);

      return [number, summary?.posteriorMean ?? 0];
    }),
  );
  const scaledScores = scaleScores(posteriorMeans);

  return Array.from({ length: bayesianMarkovModel.numberCount }, (_value, index) => {
    const number = index + 1;
    const currentGap = bayesianCurrentGaps.value.get(number) ?? 0;
    const bucket = gapBucket(currentGap);
    const summary = bayesianBucketByGap.get(bucket);
    const scoreValue = scaledScores.get(number) ?? 0;
    const band = bandForScore(scoreValue);

    return {
      number,
      rank: 0,
      score: scoreValue,
      currentGap,
      bucket,
      posteriorMean: summary?.posteriorMean ?? 0,
      posteriorMedian: summary?.posteriorMedian ?? 0,
      credibleLow90: summary?.credibleLow90 ?? 0,
      credibleHigh90: summary?.credibleHigh90 ?? 0,
      bandId: band.id,
      label: band.label,
    };
  })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.posteriorMean - left.posteriorMean ||
        right.currentGap - left.currentGap ||
        left.number - right.number,
    )
    .map((prediction, index) => ({
      ...prediction,
      rank: index + 1,
    }));
});

const predictions = computed(() =>
  buildCurrentCombinedPredictionRows({
    freshnessPredictions: props.freshnessModel.predictions,
    proximityPredictions: props.proximityModel.predictions,
    bayesianPredictions: bayesianPredictions.value,
    predictiveRows: predictiveScoreGrid.numbers,
    coOccurrencePredictions: coOccurrenceModel.value.predictions,
  }),
);
const topNumbers = computed(() =>
  predictions.value.slice(0, bayesianMarkovModel.numbersPerDraw).map((prediction) => prediction.number),
);
const bandCounts = computed(() =>
  bands.map((band) => ({
    ...band,
    count: predictions.value.filter((prediction) => bandForScore(prediction.score).id === band.id).length,
  })),
);
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell markov-score-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @close-workspace-view="emit('closeWorkspaceView', $event)"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <StatisticsReferenceNavigation
        :max-reference-draw-offset="maxReferenceDrawOffset"
        :reference-draw-date="referenceDate"
        :reference-draw-offset="referenceDrawOffset"
        @first-reference-draw="emit('firstReferenceDraw')"
        @latest-reference-draw="emit('latestReferenceDraw')"
        @next-reference-draw="emit('nextReferenceDraw')"
        @previous-reference-draw="emit('previousReferenceDraw')"
      >
        <p class="reference-pill">
          Draws
          <strong>{{ history.draws.length }}</strong>
        </p>
        <p class="reference-pill">
          Mix
          <strong>Fr Pr By Grid Co</strong>
        </p>
        <p class="reference-pill">
          Top
          <strong>{{ topNumbers.join(", ") }}</strong>
        </p>
      </StatisticsReferenceNavigation>

      <div class="dialog-body freshness-dialog-body">
        <section class="freshness-band">
          <h3>Mixed Prediction Bands</h3>
          <div class="freshness-buckets markov-score-buckets">
            <article
              v-for="band in bandCounts"
              :key="band.id"
              class="freshness-bucket"
              :style="{ '--bucket-color': band.color }"
            >
              <span class="freshness-swatch"></span>
              <strong>{{ band.label }}</strong>
              <p>{{ band.description }} Count {{ band.count }}.</p>
            </article>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Next Draw Mixed Ranking</h3>
            <div class="freshness-prediction-grid">
              <div
                v-for="prediction in predictions"
                :key="prediction.number"
                class="freshness-prediction-cell markov-score-cell"
                :class="{ 'prediction-hit': hitNumbers.has(prediction.number) }"
                :style="{ '--bucket-color': bandColor(prediction.score) }"
                :title="`Mixed rank ${prediction.rank} | score ${score(prediction.score)} | Fr ${rankLabel(prediction.freshnessRank)} | Pr ${rankLabel(prediction.proximityRank)} | By ${rankLabel(prediction.bayesianRank)} | Grid ${rankLabel(prediction.predictiveRank)} | Co ${rankLabel(prediction.coOccurrenceRank)}`"
              >
                <strong>{{ prediction.number }}</strong>
                <span>{{ score(prediction.score) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Top Mixed Picks</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>No.</span>
                <span>Score</span>
                <span>Agree</span>
                <span>Top 6</span>
              </div>
              <div
                v-for="prediction in predictions.slice(0, 12)"
                :key="`top-${prediction.number}`"
                class="freshness-row"
              >
                <span>{{ prediction.rank }}</span>
                <span>
                  <b
                    class="prediction-number-marker"
                    :class="{ 'prediction-hit': hitNumbers.has(prediction.number) }"
                  >
                    {{ prediction.number }}
                  </b>
                </span>
                <span>{{ score(prediction.score) }}</span>
                <span>{{ prediction.agreementCount }}/5</span>
                <span>{{ prediction.topSixCount }}/5</span>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Strategy Rank Breakdown</h3>
            <div class="freshness-summary-table compact bayesian-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>No.</span>
                <span>Fr</span>
                <span>Pr</span>
                <span>By</span>
                <span>Grid</span>
              </div>
              <div
                v-for="prediction in predictions.slice(0, 18)"
                :key="`breakdown-${prediction.number}`"
                class="freshness-row"
              >
                <span>{{ prediction.number }}</span>
                <span>{{ rankLabel(prediction.freshnessRank) }}</span>
                <span>{{ rankLabel(prediction.proximityRank) }}</span>
                <span>{{ rankLabel(prediction.bayesianRank) }}</span>
                <span>{{ rankLabel(prediction.predictiveRank) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Co-occurrence Contribution</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>No.</span>
                <span>Co</span>
                <span>Mixed</span>
                <span>Votes</span>
              </div>
              <div
                v-for="prediction in predictions.slice(0, 18)"
                :key="`co-${prediction.number}`"
                class="freshness-row"
              >
                <span>{{ prediction.rank }}</span>
                <span>{{ prediction.number }}</span>
                <span>{{ rankLabel(prediction.coOccurrenceRank) }}</span>
                <span>{{ score(prediction.score) }}</span>
                <span>{{ prediction.agreementCount }}/5</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

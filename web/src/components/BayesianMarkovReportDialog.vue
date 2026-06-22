<script setup lang="ts">
import { computed } from "vue";
import bayesianMarkovScoreJson from "../data/bayesian-markov-score.json";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type {
  BayesianMarkovModel,
  BayesianMarkovPrediction,
  BayesianMarkovProfileNumber,
  EnrichedHistory,
  WorkspaceTab,
  WorkspaceView,
} from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  history: EnrichedHistory;
  maxReferenceDrawOffset: number;
  nextActualDraw: EnrichedHistory["draws"][number] | null;
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

const model = bayesianMarkovScoreJson as BayesianMarkovModel;
const topBuckets = [...model.bucketSummaries]
  .sort(
    (left, right) =>
      right.score - left.score ||
      right.posteriorMean - left.posteriorMean ||
      left.bucket - right.bucket,
  )
  .slice(0, 12);
const maxBucketScore = Math.max(...model.bucketSummaries.map((summary) => summary.score), 1);
const bands = [
  { id: "elite", label: "Elite", color: "#0a562c", description: "Posterior score from 80 to 100." },
  { id: "strong", label: "Strong", color: "#47b25c", description: "Posterior score from 60 to 79.99." },
  { id: "active", label: "Active", color: "#f0b44f", description: "Posterior score from 40 to 59.99." },
  { id: "soft", label: "Soft", color: "#7b8798", description: "Posterior score below 40." },
];

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function score(value: number): string {
  return value.toFixed(1);
}

function bandColor(bandId: string): string {
  return bands.find((band) => band.id === bandId)?.color ?? "#7b8798";
}

function gapBucket(gap: number): number {
  return Math.min(Math.max(gap, 0), model.maxGapBucket);
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

const bucketByGap = new Map(model.bucketSummaries.map((summary) => [summary.bucket, summary]));
const latestReferenceDraw = computed(
  () => props.history.draws[props.history.draws.length - 1] ?? null,
);
const referenceDate = computed(() => latestReferenceDraw.value?.date ?? null);
const hitNumbers = computed(
  () => new Set(props.nextActualDraw?.numbers.map((number) => number.value) ?? []),
);
const currentGaps = computed(() => {
  const lastSeen = new Map<number, number | null>();

  for (let number = 1; number <= model.numberCount; number += 1) {
    lastSeen.set(number, null);
  }

  props.history.draws.forEach((draw, drawIndex) => {
    for (const number of draw.numbers) {
      lastSeen.set(number.value, drawIndex);
    }
  });

  const drawCount = props.history.draws.length;

  return new Map(
    Array.from({ length: model.numberCount }, (_value, index) => {
      const number = index + 1;
      const seenAt = lastSeen.get(number) ?? null;
      return [number, seenAt === null ? drawCount : drawCount - 1 - seenAt];
    }),
  );
});
const predictions = computed<BayesianMarkovPrediction[]>(() => {
  const posteriorMeans = new Map(
    Array.from({ length: model.numberCount }, (_value, index) => {
      const number = index + 1;
      const bucket = gapBucket(currentGaps.value.get(number) ?? 0);
      const summary = bucketByGap.get(bucket);

      return [number, summary?.posteriorMean ?? 0];
    }),
  );
  const scaledScores = scaleScores(posteriorMeans);

  return Array.from({ length: model.numberCount }, (_value, index) => {
    const number = index + 1;
    const currentGap = currentGaps.value.get(number) ?? 0;
    const bucket = gapBucket(currentGap);
    const summary = bucketByGap.get(bucket);
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
const topNumbers = computed(() =>
  predictions.value.slice(0, model.numbersPerDraw).map((prediction) => prediction.number),
);
const latestProfile = computed<{
  date: string | null;
  signature: string;
  numbers: BayesianMarkovProfileNumber[];
}>(() => {
  const latestDraw = latestReferenceDraw.value;

  if (!latestDraw) {
    return {
      date: null,
      signature: "n/a",
      numbers: [],
    };
  }

  const numbers: BayesianMarkovProfileNumber[] = latestDraw.numbers
    .map((number) => {
      const bucket = gapBucket(number.gap);
      const summary = bucketByGap.get(bucket);
      const scoreValue = summary?.score ?? 0;
      const band = bandForScore(scoreValue);

      return {
        number: number.value,
        gap: number.gap,
        bucket,
        score: scoreValue,
        posteriorMean: summary?.posteriorMean ?? 0,
        credibleLow90: summary?.credibleLow90 ?? 0,
        credibleHigh90: summary?.credibleHigh90 ?? 0,
        bandId: band.id,
        label: band.label,
      };
    })
    .sort((left, right) => right.score - left.score || left.number - right.number);
  const labelCounts = new Map<string, number>();

  for (const number of numbers) {
    labelCounts.set(number.label, (labelCounts.get(number.label) ?? 0) + 1);
  }

  return {
    date: latestDraw.date,
    signature: [...labelCounts.entries()]
      .map(([label, count]) => `${label} x${count}`)
      .join(" + "),
    numbers,
  };
});
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell bayesian-markov-dialog-shell">
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
          Model
          <strong>{{ model.model }}</strong>
        </p>
        <p class="reference-pill">
          Samples
          <strong>{{ model.chains }} x {{ model.posteriorDraws }}</strong>
        </p>
        <p class="reference-pill">
          Top
          <strong>{{ topNumbers.join(", ") }}</strong>
        </p>
      </StatisticsReferenceNavigation>

      <div class="dialog-body freshness-dialog-body">
        <section class="freshness-band">
          <h3>Bayesian Score Bands</h3>
          <div class="freshness-buckets markov-score-buckets">
            <article
              v-for="band in bands"
              :key="band.id"
              class="freshness-bucket"
              :style="{ '--bucket-color': band.color }"
            >
              <span class="freshness-swatch"></span>
              <strong>{{ band.label }}</strong>
              <p>{{ band.description }}</p>
            </article>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Posterior Gap Buckets</h3>
            <svg class="freshness-chart" viewBox="0 0 760 320" role="img">
              <line x1="44" x2="732" y1="260" y2="260" class="freshness-axis" />
              <g
                v-for="(summary, index) in topBuckets"
                :key="summary.bucket"
                :transform="`translate(${52 + index * 56}, 0)`"
              >
                <rect
                  :height="Math.max(2, (summary.score / maxBucketScore) * 190)"
                  width="34"
                  x="0"
                  :y="260 - Math.max(2, (summary.score / maxBucketScore) * 190)"
                  class="freshness-bar"
                  :style="{ fill: bandColor(summary.bandId) }"
                  rx="6"
                />
                <text x="17" y="284" class="freshness-chart-label">g{{ summary.bucket }}</text>
                <text x="17" :y="248 - Math.max(2, (summary.score / maxBucketScore) * 190)" class="freshness-chart-value">
                  {{ score(summary.score) }}
                </text>
              </g>
            </svg>
            <div class="freshness-summary-table bayesian-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Bucket</span>
                <span>Score</span>
                <span>Mean</span>
                <span>90% low</span>
                <span>90% high</span>
              </div>
              <div
                v-for="summary in topBuckets"
                :key="`bucket-${summary.bucket}`"
                class="freshness-row"
              >
                <span>{{ summary.bucket }}</span>
                <span>{{ score(summary.score) }}</span>
                <span>{{ percent(summary.posteriorMean) }}</span>
                <span>{{ percent(summary.credibleLow90) }}</span>
                <span>{{ percent(summary.credibleHigh90) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Latest Draw Bayesian Profile</h3>
            <p class="freshness-signature">{{ latestProfile.signature }}</p>
            <div class="freshness-number-list">
              <div
                v-for="number in latestProfile.numbers"
                :key="number.number"
                class="freshness-number-card"
                :style="{ '--bucket-color': bandColor(number.bandId) }"
              >
                <strong>{{ number.number }}</strong>
                <span>{{ number.label }}</span>
                <small>score {{ score(number.score) }} | {{ percent(number.posteriorMean) }}</small>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Model Setup</h3>
            <div class="freshness-summary-table bayesian-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Setting</span>
                <span>Value</span>
                <span>Setting</span>
                <span>Value</span>
                <span>Seed</span>
              </div>
              <div class="freshness-row">
                <span>Prior</span>
                <span>{{ model.priorStrength }}</span>
                <span>Tune</span>
                <span>{{ model.tuneDraws }}</span>
                <span>{{ model.randomSeed }}</span>
              </div>
              <div class="freshness-row">
                <span>Max gap</span>
                <span>{{ model.maxGapBucket }}</span>
                <span>Draws</span>
                <span>{{ model.posteriorDraws }}</span>
                <span>{{ model.chains }} chains</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Next Draw Bayesian Ranking</h3>
            <div class="freshness-prediction-grid">
              <div
                v-for="prediction in predictions"
                :key="prediction.number"
                class="freshness-prediction-cell markov-score-cell"
                :class="{ 'prediction-hit': hitNumbers.has(prediction.number) }"
                :style="{ '--bucket-color': bandColor(prediction.bandId) }"
                :title="`${prediction.label} | score ${score(prediction.score)} | posterior ${percent(prediction.posteriorMean)} | 90% ${percent(prediction.credibleLow90)}-${percent(prediction.credibleHigh90)} | gap ${prediction.currentGap}`"
              >
                <strong>{{ prediction.number }}</strong>
                <span>{{ score(prediction.score) }}</span>
              </div>
            </div>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>No.</span>
                <span>Score</span>
                <span>Gap</span>
                <span>Mean</span>
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
                <span>{{ prediction.currentGap }}</span>
                <span>{{ percent(prediction.posteriorMean) }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

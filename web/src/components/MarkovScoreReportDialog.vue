<script setup lang="ts">
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type { MarkovScoreModel, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  maxReferenceDrawOffset: number;
  model: MarkovScoreModel;
  referenceDrawOffset: number;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  firstReferenceDraw: [];
  latestReferenceDraw: [];
  nextReferenceDraw: [];
  previousReferenceDraw: [];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const maxSituationCount = Math.max(...props.model.situations.map((situation) => situation.count), 1);
const maxBucketScore = Math.max(...props.model.bucketSummaries.map((summary) => summary.score), 1);
const topBuckets = [...props.model.bucketSummaries]
  .sort(
    (left, right) =>
      right.score - left.score ||
      right.probability - left.probability ||
      left.bucket - right.bucket,
  )
  .slice(0, 12);

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function score(value: number): string {
  return value.toFixed(1);
}

function bandColor(bandId: string): string {
  return props.model.bands.find((band) => band.id === bandId)?.color ?? "#7b8798";
}
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell markov-score-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <StatisticsReferenceNavigation
        :max-reference-draw-offset="maxReferenceDrawOffset"
        :reference-draw-date="model.latestProfile?.date ?? null"
        :reference-draw-offset="referenceDrawOffset"
        @first-reference-draw="emit('firstReferenceDraw')"
        @latest-reference-draw="emit('latestReferenceDraw')"
        @next-reference-draw="emit('nextReferenceDraw')"
        @previous-reference-draw="emit('previousReferenceDraw')"
      >
        <p class="reference-pill">
          Draws
          <strong>{{ model.drawCount }}</strong>
        </p>
        <p class="reference-pill">
          Situations
          <strong>{{ model.situationCount }}</strong>
        </p>
        <p class="reference-pill">
          Half-life
          <strong>{{ model.halfLife }}</strong>
        </p>
        <p class="reference-pill">
          Max bucket
          <strong>{{ model.maxGapBucket }}</strong>
        </p>
      </StatisticsReferenceNavigation>

      <div class="dialog-body freshness-dialog-body">
        <section class="freshness-band">
          <h3>Markov Score Bands</h3>
          <div class="freshness-buckets markov-score-buckets">
            <article
              v-for="band in model.bands"
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
            <h3>Top Gap Buckets</h3>
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
            <div class="freshness-summary-table markov-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Bucket</span>
                <span>Score</span>
                <span>Prob.</span>
                <span>Hits</span>
                <span>Opp.</span>
              </div>
              <div
                v-for="summary in topBuckets"
                :key="`bucket-${summary.bucket}`"
                class="freshness-row"
              >
                <span>{{ summary.bucket }}</span>
                <span>{{ score(summary.score) }}</span>
                <span>{{ percent(summary.probability) }}</span>
                <span>{{ summary.weightedHits.toFixed(1) }}</span>
                <span>{{ summary.weightedOpportunities.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Latest Draw Markov Profile</h3>
            <p class="freshness-signature">{{ model.latestProfile?.signature ?? "n/a" }}</p>
            <div class="freshness-number-list">
              <div
                v-for="number in model.latestProfile?.numbers ?? []"
                :key="number.number"
                class="freshness-number-card"
                :style="{ '--bucket-color': bandColor(number.bandId) }"
              >
                <strong>{{ number.number }}</strong>
                <span>{{ number.label }}</span>
                <small>score {{ score(number.score) }} | gap {{ number.gap }}</small>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Situation Occurrences</h3>
            <div class="freshness-situations">
              <div
                v-for="situation in model.situations.slice(0, 28)"
                :key="situation.signature"
                class="freshness-situation"
              >
                <div>
                  <strong>{{ situation.signature }}</strong>
                  <span>{{ situation.count }} times | {{ percent(situation.percent) }} | latest {{ situation.latestDate }}</span>
                </div>
                <div class="freshness-situation-bar">
                  <span :style="{ width: `${Math.max(3, (situation.count / maxSituationCount) * 100)}%` }"></span>
                </div>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Next Draw Markov Ranking</h3>
            <div class="freshness-prediction-grid">
              <div
                v-for="prediction in model.predictions"
                :key="prediction.number"
                class="freshness-prediction-cell markov-score-cell"
                :style="{ '--bucket-color': bandColor(prediction.bandId) }"
                :title="`${prediction.label} | score ${score(prediction.score)} | probability ${percent(prediction.probability)} | gap ${prediction.currentGap} | bucket ${prediction.bucket}`"
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
                <span>Prob.</span>
              </div>
              <div
                v-for="prediction in model.predictions.slice(0, 12)"
                :key="`top-${prediction.number}`"
                class="freshness-row"
              >
                <span>{{ prediction.rank }}</span>
                <span>{{ prediction.number }}</span>
                <span>{{ score(prediction.score) }}</span>
                <span>{{ prediction.currentGap }}</span>
                <span>{{ percent(prediction.probability) }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

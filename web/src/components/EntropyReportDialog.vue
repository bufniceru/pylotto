<script setup lang="ts">
import { computed } from "vue";
import { buildEntropyModel } from "../lib/structuralEntropy";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type { EnrichedDraw, EnrichedHistory, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  history: EnrichedHistory;
  maxReferenceDrawOffset: number;
  nextActualDraw: EnrichedDraw | null;
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

const model = computed(() => buildEntropyModel(props.history));
const maxSituationCount = computed(() =>
  Math.max(...model.value.situations.map((situation) => situation.count), 1),
);
const maxBucketCount = computed(() =>
  Math.max(...model.value.bucketSummaries.map((summary) => summary.count), 1),
);
const hitNumbers = computed(
  () => new Set(props.nextActualDraw?.numbers.map((number) => number.value) ?? []),
);

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function score(value: number): string {
  return `${value.toFixed(1)}%`;
}

function bits(value: number): string {
  return `${value.toFixed(2)}`;
}

function bucketColor(bucketId: string): string {
  return model.value.buckets.find((bucket) => bucket.id === bucketId)?.color ?? "#7b8798";
}
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell entropy-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @close-workspace-view="emit('closeWorkspaceView', $event)"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <StatisticsReferenceNavigation
        :max-reference-draw-offset="maxReferenceDrawOffset"
        :reference-draw-date="model.latestProfile.date"
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
          Latest
          <strong>{{ score(model.latestProfile.report?.structuralPercent ?? 0) }}</strong>
        </p>
      </StatisticsReferenceNavigation>

      <div class="dialog-body freshness-dialog-body">
        <section class="freshness-band">
          <h3>Entropy Report</h3>
          <div class="freshness-buckets entropy-buckets">
            <article
              v-for="bucket in model.buckets"
              :key="bucket.id"
              class="freshness-bucket"
              :style="{ '--bucket-color': bucket.color }"
            >
              <span class="freshness-swatch"></span>
              <strong>{{ bucket.label }}</strong>
              <p>{{ bucket.description }}</p>
            </article>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Historical Entropy Frequency</h3>
            <svg class="freshness-chart" viewBox="0 0 760 320" role="img">
              <line x1="44" x2="732" y1="260" y2="260" class="freshness-axis" />
              <g
                v-for="(summary, index) in model.bucketSummaries"
                :key="summary.bucketId"
                :transform="`translate(${72 + index * 118}, 0)`"
              >
                <rect
                  :height="Math.max(2, (summary.count / maxBucketCount) * 190)"
                  width="52"
                  x="0"
                  :y="260 - Math.max(2, (summary.count / maxBucketCount) * 190)"
                  class="freshness-bar"
                  :style="{ fill: bucketColor(summary.bucketId) }"
                  rx="6"
                />
                <text x="26" y="284" class="freshness-chart-label">{{ summary.label }}</text>
                <text x="26" :y="248 - Math.max(2, (summary.count / maxBucketCount) * 190)" class="freshness-chart-value">
                  {{ summary.count }}
                </text>
              </g>
            </svg>
            <div class="freshness-summary-table entropy-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Bucket</span>
                <span>Count</span>
                <span>Share</span>
                <span>Avg bits</span>
                <span>Avg %</span>
              </div>
              <div
                v-for="summary in model.bucketSummaries"
                :key="summary.bucketId"
                class="freshness-row"
              >
                <span>{{ summary.label }}</span>
                <span>{{ summary.count }}</span>
                <span>{{ percent(summary.share) }}</span>
                <span>{{ bits(summary.averageBits) }}</span>
                <span>{{ score(summary.averagePercent) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Latest Draw Entropy Profile</h3>
            <p class="freshness-signature">{{ model.latestProfile.signature }}</p>
            <div class="freshness-number-list">
              <div
                v-for="number in model.latestProfile.numbers"
                :key="number.number"
                class="freshness-number-card"
                :style="{ '--bucket-color': bucketColor(number.label === 'n/a' ? 'structured' : model.predictions.find((prediction) => prediction.number === number.number)?.bucketId ?? 'structured') }"
              >
                <strong>{{ number.number }}</strong>
                <span>{{ score(number.score) }}</span>
                <small>avg {{ score(number.entropyPercent) }} | gap {{ number.currentGap }}</small>
              </div>
            </div>
            <div class="freshness-summary-table compact entropy-lens-table">
              <div class="freshness-row freshness-row-head">
                <span>Lens</span>
                <span>Bits</span>
                <span>Selected</span>
              </div>
              <div
                v-for="lens in model.latestProfile.report?.lenses ?? []"
                :key="lens.id"
                class="freshness-row"
              >
                <span>{{ lens.label }}</span>
                <span>{{ bits(lens.bits) }}</span>
                <span>{{ lens.selected ? "yes" : "no" }}</span>
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
            <h3>Next Draw Entropy Prediction</h3>
            <div class="freshness-prediction-grid">
              <div
                v-for="prediction in model.predictions"
                :key="prediction.number"
                class="freshness-prediction-cell"
                :class="{ 'prediction-hit': hitNumbers.has(prediction.number) }"
                :style="{ '--bucket-color': bucketColor(prediction.bucketId) }"
                :title="`${prediction.label} | score ${score(prediction.score)} | avg entropy ${score(prediction.entropyPercent)} | high entropy ${percent(prediction.highEntropyShare)} | hits ${prediction.appearances} | gap ${prediction.currentGap}`"
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
                <span>Avg %</span>
                <span>Hits</span>
                <span>Gap</span>
              </div>
              <div
                v-for="prediction in model.predictions.slice(0, 12)"
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
                <span>{{ score(prediction.entropyPercent) }}</span>
                <span>{{ prediction.appearances }}</span>
                <span>{{ prediction.currentGap }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

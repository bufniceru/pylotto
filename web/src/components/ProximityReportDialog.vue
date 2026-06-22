<script setup lang="ts">
import { computed } from "vue";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type { EnrichedDraw, ProximityModel, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  maxReferenceDrawOffset: number;
  model: ProximityModel;
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

const maxSituationCount = Math.max(...props.model.situations.map((situation) => situation.count), 1);
const maxBucketCount = Math.max(...props.model.bucketSummaries.map((summary) => summary.count), 1);
const latestNumbers = props.model.latestProfile?.numbers ?? [];
const hitNumbers = computed(
  () => new Set(props.nextActualDraw?.numbers.map((number) => number.value) ?? []),
);

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function score(value: number): string {
  return value.toFixed(4);
}

function bucketColor(bucketId: string): string {
  return props.model.buckets.find((bucket) => bucket.id === bucketId)?.color ?? "#7b8798";
}

function xForNumber(number: number): number {
  return 34 + ((number - 1) / 48) * 672;
}
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell proximity-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @close-workspace-view="emit('closeWorkspaceView', $event)"
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
      </StatisticsReferenceNavigation>

      <div class="dialog-body freshness-dialog-body">
        <section class="freshness-band">
          <h3>Proximity Characterization</h3>
          <div class="freshness-buckets proximity-buckets">
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
            <h3>Historical Proximity Frequency</h3>
            <svg class="freshness-chart" viewBox="0 0 760 320" role="img">
              <line x1="44" x2="732" y1="260" y2="260" class="freshness-axis" />
              <g
                v-for="(summary, index) in model.bucketSummaries"
                :key="summary.bucketId"
                :transform="`translate(${76 + index * 104}, 0)`"
              >
                <rect
                  :height="Math.max(2, (summary.count / maxBucketCount) * 190)"
                  width="48"
                  x="0"
                  :y="260 - Math.max(2, (summary.count / maxBucketCount) * 190)"
                  class="freshness-bar"
                  :style="{ fill: bucketColor(summary.bucketId) }"
                  rx="6"
                />
                <text x="24" y="284" class="freshness-chart-label">{{ summary.label }}</text>
                <text x="24" :y="248 - Math.max(2, (summary.count / maxBucketCount) * 190)" class="freshness-chart-value">
                  {{ summary.count }}
                </text>
              </g>
            </svg>
            <div class="freshness-summary-table proximity-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Bucket</span>
                <span>Count</span>
                <span>Share</span>
                <span>Avg near</span>
              </div>
              <div
                v-for="summary in model.bucketSummaries"
                :key="summary.bucketId"
                class="freshness-row"
              >
                <span>{{ summary.label }}</span>
                <span>{{ summary.count }}</span>
                <span>{{ percent(summary.share) }}</span>
                <span>{{ summary.averageNearestDistance.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Latest Draw Spacing</h3>
            <p class="freshness-signature">{{ model.latestProfile?.signature ?? "n/a" }}</p>
            <svg class="proximity-strip-chart" viewBox="0 0 740 150" role="img">
              <line x1="34" x2="706" y1="74" y2="74" class="proximity-axis" />
              <g v-for="tick in [1, 10, 20, 30, 40, 49]" :key="`tick-${tick}`">
                <line :x1="xForNumber(tick)" :x2="xForNumber(tick)" y1="64" y2="84" class="proximity-tick" />
                <text :x="xForNumber(tick)" y="108" class="freshness-chart-label">{{ tick }}</text>
              </g>
              <g v-for="(number, index) in latestNumbers" :key="number.number">
                <line
                  v-if="index < latestNumbers.length - 1"
                  :x1="xForNumber(number.number)"
                  :x2="xForNumber(latestNumbers[index + 1].number)"
                  y1="74"
                  y2="74"
                  class="proximity-gap-line"
                />
                <circle
                  :cx="xForNumber(number.number)"
                  cy="74"
                  r="16"
                  :style="{ fill: bucketColor(number.bucketId) }"
                />
                <text :x="xForNumber(number.number)" y="79" class="proximity-number-label">{{ number.number }}</text>
              </g>
            </svg>
            <div class="freshness-number-list">
              <div
                v-for="number in latestNumbers"
                :key="number.number"
                class="freshness-number-card"
                :style="{ '--bucket-color': bucketColor(number.bucketId) }"
              >
                <strong>{{ number.number }}</strong>
                <span>{{ number.label }}</span>
                <small>nearest {{ number.nearestDistance }}</small>
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
            <h3>Next Draw Proximity Prediction</h3>
            <div class="freshness-prediction-grid">
              <div
                v-for="prediction in model.predictions"
                :key="prediction.number"
                class="freshness-prediction-cell"
                :class="{ 'prediction-hit': hitNumbers.has(prediction.number) }"
                :style="{ '--bucket-color': bucketColor(prediction.bucketId) }"
                :title="`${prediction.label} | appearances ${prediction.appearances} | score ${score(prediction.score)}`"
              >
                <strong>{{ prediction.number }}</strong>
                <span>#{{ prediction.rank }}</span>
              </div>
            </div>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>No.</span>
                <span>Role</span>
                <span>Hits</span>
                <span>Score</span>
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
                <span>{{ prediction.label }}</span>
                <span>{{ prediction.appearances }}</span>
                <span>{{ score(prediction.score) }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

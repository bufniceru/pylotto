<script setup lang="ts">
import { computed } from "vue";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type {
  AutocorrelationLagSummary,
  AutocorrelationModel,
  WorkspaceTab,
  WorkspaceView,
} from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  maxReferenceDrawOffset: number;
  model: AutocorrelationModel;
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

const chartScale = computed(() =>
  Math.max(...props.model.lagSummaries.map((summary) => Math.abs(summary.score)), 0.1),
);
const topPositiveOverlap = computed(() =>
  [...props.model.lagSummaries]
    .sort((left, right) => right.overlapDelta - left.overlapDelta || left.lag - right.lag)
    .slice(0, 8),
);
const topNegativeOverlap = computed(() =>
  [...props.model.lagSummaries]
    .sort((left, right) => left.overlapDelta - right.overlapDelta || left.lag - right.lag)
    .slice(0, 8),
);
const topPositiveDoublets = computed(() =>
  [...props.model.lagSummaries]
    .sort((left, right) => right.doubletDelta - left.doubletDelta || left.lag - right.lag)
    .slice(0, 8),
);
const topNegativeDoublets = computed(() =>
  [...props.model.lagSummaries]
    .sort((left, right) => left.doubletDelta - right.doubletDelta || left.lag - right.lag)
    .slice(0, 8),
);
const topPositiveTriplets = computed(() =>
  [...props.model.lagSummaries]
    .sort((left, right) => right.tripletDelta - left.tripletDelta || left.lag - right.lag)
    .slice(0, 8),
);
const topNegativeTriplets = computed(() =>
  [...props.model.lagSummaries]
    .sort((left, right) => left.tripletDelta - right.tripletDelta || left.lag - right.lag)
    .slice(0, 8),
);

function decimal(value: number, digits = 3): string {
  return value.toFixed(digits);
}

function signed(value: number, digits = 3): string {
  return `${value >= 0 ? "+" : ""}${decimal(value, digits)}`;
}

function bandColor(bandId: string): string {
  return props.model.bands.find((band) => band.id === bandId)?.color ?? "#7b8798";
}

function strongestSignal(summary: AutocorrelationLagSummary): string {
  const signals = [
    { label: "number", value: summary.numberPresenceCorrelation },
    { label: "sum", value: summary.sumCorrelation },
    { label: "odd", value: summary.oddCountCorrelation },
    { label: "low", value: summary.lowCountCorrelation },
  ].sort((left, right) => Math.abs(right.value) - Math.abs(left.value));

  return `${signals[0].label} ${signed(signals[0].value)}`;
}
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell freshness-dialog-shell">
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
          Max lag
          <strong>{{ model.maxLag }}</strong>
        </p>
        <p class="reference-pill">
          Strongest lag
          <strong>{{ model.strongestLag?.lag ?? "n/a" }}</strong>
        </p>
        <p class="reference-pill">
          Expected overlap
          <strong>{{ decimal(model.expectedOverlap, 2) }}</strong>
        </p>
        <p class="reference-pill">
          E doublet/triplet
          <strong>{{ decimal(model.expectedDoublets, 3) }} / {{ decimal(model.expectedTriplets, 3) }}</strong>
        </p>
      </StatisticsReferenceNavigation>

      <div class="dialog-body freshness-dialog-body">
        <section class="freshness-band">
          <h3>Autocorrelation Report</h3>
          <p class="freshness-signature">{{ model.interpretation }}</p>
          <div class="freshness-buckets">
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
            <h3>Lag Strength</h3>
            <svg class="freshness-chart" viewBox="0 0 760 320" role="img">
              <line x1="44" x2="732" y1="260" y2="260" class="freshness-axis" />
              <g
                v-for="(summary, index) in model.lagSummaries"
                :key="summary.lag"
                :transform="`translate(${54 + index * 28}, 0)`"
              >
                <rect
                  :height="Math.max(2, (summary.score / chartScale) * 190)"
                  width="18"
                  x="0"
                  :y="260 - Math.max(2, (summary.score / chartScale) * 190)"
                  class="freshness-bar"
                  :style="{ fill: bandColor(summary.bandId) }"
                  rx="5"
                />
                <text
                  v-if="summary.lag % 2 === 1"
                  x="9"
                  y="284"
                  class="freshness-chart-label"
                >
                  {{ summary.lag }}
                </text>
              </g>
            </svg>
            <div class="freshness-summary-table bayesian-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Lag</span>
                <span>Overlap</span>
                <span>Number r</span>
                <span>Sum r</span>
                <span>Signal</span>
              </div>
              <div
                v-for="summary in model.lagSummaries.slice(0, 12)"
                :key="`lag-${summary.lag}`"
                class="freshness-row"
              >
                <span>{{ summary.lag }}</span>
                <span>{{ decimal(summary.averageOverlap, 2) }}</span>
                <span>{{ signed(summary.numberPresenceCorrelation) }}</span>
                <span>{{ signed(summary.sumCorrelation) }}</span>
                <span>{{ strongestSignal(summary) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Latest Draw Autocorrelation Profile</h3>
            <p class="freshness-signature">{{ model.latestProfile.signature }}</p>
            <div class="freshness-number-list">
              <div
                v-for="summary in model.latestProfile.numbers"
                :key="summary.number"
                class="freshness-number-card"
                :style="{ '--bucket-color': bandColor(summary.bandId) }"
              >
                <strong>{{ summary.number }}</strong>
                <span>{{ summary.label }}</span>
                <small>lag {{ summary.strongestLag }} | r {{ signed(summary.strongestCorrelation) }}</small>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>All Lag Metrics</h3>
            <div class="freshness-summary-table bayesian-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Lag</span>
                <span>Overlap delta</span>
                <span>Doublet delta</span>
                <span>Triplet delta</span>
                <span>Score</span>
              </div>
              <div
                v-for="summary in model.lagSummaries"
                :key="`all-lag-${summary.lag}`"
                class="freshness-row"
              >
                <span>{{ summary.lag }}</span>
                <span>{{ signed(summary.overlapDelta, 2) }}</span>
                <span>{{ signed(summary.doubletDelta, 3) }}</span>
                <span>{{ signed(summary.tripletDelta, 3) }}</span>
                <span>{{ decimal(summary.score) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Number Strongest Lags</h3>
            <div class="freshness-prediction-grid">
              <div
                v-for="summary in model.numberSummaries"
                :key="summary.number"
                class="freshness-prediction-cell"
                :style="{ '--bucket-color': bandColor(summary.bandId) }"
                :title="`${summary.label} | strongest lag ${summary.strongestLag} | r ${signed(summary.strongestCorrelation)} | appearances ${summary.appearances}`"
              >
                <strong>{{ summary.number }}</strong>
                <span>{{ summary.strongestLag }}</span>
              </div>
            </div>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>No.</span>
                <span>Lag</span>
                <span>r</span>
                <span>Seen</span>
              </div>
              <div
                v-for="summary in model.numberSummaries.slice(0, 12)"
                :key="`number-${summary.number}`"
                class="freshness-row"
              >
                <span>{{ summary.rank }}</span>
                <span>{{ summary.number }}</span>
                <span>{{ summary.strongestLag }}</span>
                <span>{{ signed(summary.strongestCorrelation) }}</span>
                <span>{{ summary.appearances }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Highest Overlap Lags</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Lag</span>
                <span>Overlap</span>
                <span>Delta</span>
                <span>Pairs</span>
                <span>Rate</span>
              </div>
              <div
                v-for="summary in topPositiveOverlap"
                :key="`positive-overlap-${summary.lag}`"
                class="freshness-row"
              >
                <span>{{ summary.lag }}</span>
                <span>{{ decimal(summary.averageOverlap, 2) }}</span>
                <span>{{ signed(summary.overlapDelta, 2) }}</span>
                <span>{{ summary.pairCount }}</span>
                <span>{{ decimal(summary.overlapRate * 100, 1) }}%</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Lowest Overlap Lags</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Lag</span>
                <span>Overlap</span>
                <span>Delta</span>
                <span>Pairs</span>
                <span>Rate</span>
              </div>
              <div
                v-for="summary in topNegativeOverlap"
                :key="`negative-overlap-${summary.lag}`"
                class="freshness-row"
              >
                <span>{{ summary.lag }}</span>
                <span>{{ decimal(summary.averageOverlap, 2) }}</span>
                <span>{{ signed(summary.overlapDelta, 2) }}</span>
                <span>{{ summary.pairCount }}</span>
                <span>{{ decimal(summary.overlapRate * 100, 1) }}%</span>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Highest Doublet Repeat Lags</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Lag</span>
                <span>Doublets</span>
                <span>Delta</span>
                <span>Expected</span>
                <span>Pairs</span>
              </div>
              <div
                v-for="summary in topPositiveDoublets"
                :key="`positive-doublet-${summary.lag}`"
                class="freshness-row"
              >
                <span>{{ summary.lag }}</span>
                <span>{{ decimal(summary.averageDoublets, 3) }}</span>
                <span>{{ signed(summary.doubletDelta, 3) }}</span>
                <span>{{ decimal(summary.expectedDoublets, 3) }}</span>
                <span>{{ summary.pairCount }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Lowest Doublet Repeat Lags</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Lag</span>
                <span>Doublets</span>
                <span>Delta</span>
                <span>Expected</span>
                <span>Pairs</span>
              </div>
              <div
                v-for="summary in topNegativeDoublets"
                :key="`negative-doublet-${summary.lag}`"
                class="freshness-row"
              >
                <span>{{ summary.lag }}</span>
                <span>{{ decimal(summary.averageDoublets, 3) }}</span>
                <span>{{ signed(summary.doubletDelta, 3) }}</span>
                <span>{{ decimal(summary.expectedDoublets, 3) }}</span>
                <span>{{ summary.pairCount }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Highest Triplet Repeat Lags</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Lag</span>
                <span>Triplets</span>
                <span>Delta</span>
                <span>Expected</span>
                <span>Pairs</span>
              </div>
              <div
                v-for="summary in topPositiveTriplets"
                :key="`positive-triplet-${summary.lag}`"
                class="freshness-row"
              >
                <span>{{ summary.lag }}</span>
                <span>{{ decimal(summary.averageTriplets, 3) }}</span>
                <span>{{ signed(summary.tripletDelta, 3) }}</span>
                <span>{{ decimal(summary.expectedTriplets, 3) }}</span>
                <span>{{ summary.pairCount }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Lowest Triplet Repeat Lags</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Lag</span>
                <span>Triplets</span>
                <span>Delta</span>
                <span>Expected</span>
                <span>Pairs</span>
              </div>
              <div
                v-for="summary in topNegativeTriplets"
                :key="`negative-triplet-${summary.lag}`"
                class="freshness-row"
              >
                <span>{{ summary.lag }}</span>
                <span>{{ decimal(summary.averageTriplets, 3) }}</span>
                <span>{{ signed(summary.tripletDelta, 3) }}</span>
                <span>{{ decimal(summary.expectedTriplets, 3) }}</span>
                <span>{{ summary.pairCount }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

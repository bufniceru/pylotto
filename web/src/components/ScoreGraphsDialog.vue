<script setup lang="ts">
import { computed, ref, watch } from "vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import { buildBayesianMarkovPredictionScores } from "../lib/bayesianMarkovScore";
import { buildFreshnessPredictionScores } from "../lib/freshness";
import { buildProximityPredictionScores } from "../lib/proximity";
import type { EnrichedHistory, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  history: EnrichedHistory;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const chartWidth = 1180;
const chartHeight = 500;
const padding = { top: 34, right: 28, bottom: 58, left: 58 };
const plotWidth = chartWidth - padding.left - padding.right;
const plotHeight = chartHeight - padding.top - padding.bottom;

const seriesDefinitions = [
  { id: "freshness", label: "Freshness", color: "#2563eb" },
  { id: "proximity", label: "Proximity", color: "#16a34a" },
  { id: "bayesian", label: "Bayesian", color: "#d97706" },
  { id: "drawSum", label: "Draw Sum", color: "#7c3aed" },
] as const;
type SeriesId = (typeof seriesDefinitions)[number]["id"];
type SelectedSeries = SeriesId | "all";
type DateFilterMode = "all" | "year" | "interval";
type GraphMode = "timeline" | "sumDistribution";

const graphMode = ref<GraphMode>("timeline");
const filterMode = ref<DateFilterMode>("all");
const selectedSeries = ref<SelectedSeries>("freshness");
const selectedYear = ref(props.history.draws[props.history.draws.length - 1]?.date.slice(0, 4) ?? "");
const intervalStartDate = ref(props.history.draws[0]?.date ?? "");
const intervalEndDate = ref(props.history.draws[props.history.draws.length - 1]?.date ?? "");

const scoreRows = computed(() => {
  const freshnessScores = buildFreshnessPredictionScores(props.history);
  const proximityScores = buildProximityPredictionScores(props.history);
  const bayesianScores = buildBayesianMarkovPredictionScores(props.history);

  return props.history.draws.map((draw, index) => ({
    date: draw.date,
    freshness: freshnessScores[index],
    proximity: proximityScores[index],
    bayesian: bayesianScores[index],
    drawSum: draw.numbers.reduce((total, number) => total + number.value, 0),
  }));
});

const availableYears = computed(() =>
  [...new Set(scoreRows.value.map((row) => row.date.slice(0, 4)))].sort(
    (left, right) => right.localeCompare(left),
  ),
);

const displayedRows = computed(() => {
  if (filterMode.value === "year") {
    return scoreRows.value.filter((row) => row.date.startsWith(selectedYear.value));
  }

  if (filterMode.value === "interval") {
    const startDate = intervalStartDate.value;
    const endDate = intervalEndDate.value;

    return scoreRows.value.filter((row) => row.date >= startDate && row.date <= endDate);
  }

  return scoreRows.value;
});

const visibleSeries = computed(() =>
  selectedSeries.value === "all"
    ? seriesDefinitions.filter((series) => series.id !== "drawSum")
    : seriesDefinitions.filter((series) => series.id === selectedSeries.value),
);
const sumDistribution = computed(() => {
  const counts = new Map<number, number>();

  for (const row of displayedRows.value) {
    counts.set(row.drawSum, (counts.get(row.drawSum) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([sum, count]) => ({ sum, count }))
    .sort((left, right) => left.sum - right.sum);
});
const meanScores = computed<Record<SeriesId, number | null>>(() => {
  const means = {} as Record<SeriesId, number | null>;

  for (const series of seriesDefinitions) {
    const values = displayedRows.value
      .map((row) => row[series.id])
      .filter((score): score is number => score !== null);

    means[series.id] =
      values.length === 0
        ? null
        : values.reduce((total, score) => total + score, 0) / values.length;
  }

  return means;
});
const yAxisBounds = computed(() => {
  if (graphMode.value === "sumDistribution") {
    const maxCount = Math.max(...sumDistribution.value.map((row) => row.count), 1);

    return { min: 0, max: maxCount };
  }

  if (selectedSeries.value !== "drawSum") {
    return { min: 0, max: 100 };
  }

  const values = displayedRows.value
    .map((row) => row.drawSum)
    .filter((value): value is number => Number.isFinite(value));

  if (values.length === 0) {
    return { min: 0, max: 100 };
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = Math.max(maxValue - minValue, 1);
  const paddingValue = Math.max(5, spread * 0.08);

  return {
    min: Math.max(0, Math.floor(minValue - paddingValue)),
    max: Math.ceil(maxValue + paddingValue),
  };
});
const yTicks = computed(() => {
  const { min, max } = yAxisBounds.value;
  const spread = max - min;

  return Array.from({ length: 5 }, (_value, index) => min + (spread * index) / 4);
});
const xTicks = computed(() => {
  if (graphMode.value === "sumDistribution") {
    if (sumDistribution.value.length === 0) {
      return [];
    }

    const desiredTicks = 8;
    const step = Math.max(1, Math.floor((sumDistribution.value.length - 1) / (desiredTicks - 1)));
    const ticks = [];

    for (let index = 0; index < sumDistribution.value.length; index += step) {
      ticks.push(index);
    }

    const lastIndex = sumDistribution.value.length - 1;
    if (ticks[ticks.length - 1] !== lastIndex) {
      ticks.push(lastIndex);
    }

    return ticks;
  }

  if (displayedRows.value.length === 0) {
    return [];
  }

  const desiredTicks = 8;
  const step = Math.max(1, Math.floor((displayedRows.value.length - 1) / (desiredTicks - 1)));
  const ticks = [];

  for (let index = 0; index < displayedRows.value.length; index += step) {
    ticks.push(index);
  }

  const lastIndex = displayedRows.value.length - 1;
  if (ticks[ticks.length - 1] !== lastIndex) {
    ticks.push(lastIndex);
  }

  return ticks;
});

watch(
  scoreRows,
  (rows) => {
    selectedYear.value = rows[rows.length - 1]?.date.slice(0, 4) ?? "";
    intervalStartDate.value = rows[0]?.date ?? "";
    intervalEndDate.value = rows[rows.length - 1]?.date ?? "";
  },
  { immediate: true },
);

function xForIndex(index: number): number {
  if (displayedRows.value.length <= 1) {
    return padding.left;
  }

  return padding.left + (index / (displayedRows.value.length - 1)) * plotWidth;
}

function xForDistributionIndex(index: number): number {
  if (sumDistribution.value.length <= 1) {
    return padding.left + plotWidth / 2;
  }

  return padding.left + (index / (sumDistribution.value.length - 1)) * plotWidth;
}

function distributionBarWidth(): number {
  if (sumDistribution.value.length <= 1) {
    return 18;
  }

  return Math.max(3, Math.min(18, (plotWidth / sumDistribution.value.length) * 0.72));
}

function yForValue(value: number): number {
  const { min, max } = yAxisBounds.value;
  const spread = Math.max(max - min, 1);

  return padding.top + ((max - value) / spread) * plotHeight;
}

function formatAxisTick(value: number): string {
  if (graphMode.value === "sumDistribution") {
    return String(Math.round(value));
  }

  return selectedSeries.value === "drawSum" ? String(Math.round(value)) : `${Math.round(value)}%`;
}

function normalizeInterval(): void {
  if (intervalStartDate.value > intervalEndDate.value) {
    const startDate = intervalStartDate.value;
    intervalStartDate.value = intervalEndDate.value;
    intervalEndDate.value = startDate;
  }
}
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell score-graphs-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <div class="dialog-body freshness-dialog-body score-graphs-body">
        <section class="score-graph-panel">
          <div class="score-graph-header">
            <div>
              <p class="eyebrow">Statistics / Graphs</p>
              <h3>{{ graphMode === "sumDistribution" ? "Draw Sum Distribution" : "Prediction Score Timeline" }}</h3>
            </div>
            <div
              v-if="graphMode === 'timeline'"
              class="score-graph-legend"
              aria-label="Score line legend"
            >
              <span
                v-for="series in visibleSeries"
                :key="series.id"
                class="score-graph-legend-item"
              >
                <i :style="{ background: series.color }"></i>
                {{ series.label }}
              </span>
            </div>
          </div>

          <div class="score-graph-controls" aria-label="Graph date filter">
            <label class="score-graph-control">
              <span>Graph</span>
              <select v-model="graphMode">
                <option value="timeline">Timeline</option>
                <option value="sumDistribution">Sum Distribution</option>
              </select>
            </label>
            <label class="score-graph-control">
              <span>Source</span>
              <select v-model="selectedSeries" :disabled="graphMode !== 'timeline'">
                <option value="freshness">Freshness</option>
                <option value="proximity">Proximity</option>
                <option value="bayesian">Bayesian</option>
                <option value="drawSum">Draw Sum</option>
                <option value="all">All sources</option>
              </select>
            </label>
            <label class="score-graph-control">
              <span>Display</span>
              <select v-model="filterMode">
                <option value="all">All history</option>
                <option value="year">Selected year</option>
                <option value="interval">Date interval</option>
              </select>
            </label>
            <label class="score-graph-control" :class="{ disabled: filterMode !== 'year' }">
              <span>Year</span>
              <select v-model="selectedYear" :disabled="filterMode !== 'year'">
                <option v-for="year in availableYears" :key="year" :value="year">
                  {{ year }}
                </option>
              </select>
            </label>
            <label class="score-graph-control" :class="{ disabled: filterMode !== 'interval' }">
              <span>Start</span>
              <input
                v-model="intervalStartDate"
                :disabled="filterMode !== 'interval'"
                type="date"
                @change="normalizeInterval"
              />
            </label>
            <label class="score-graph-control" :class="{ disabled: filterMode !== 'interval' }">
              <span>End</span>
              <input
                v-model="intervalEndDate"
                :disabled="filterMode !== 'interval'"
                type="date"
                @change="normalizeInterval"
              />
            </label>
            <p class="score-graph-count">
              <strong>{{ displayedRows.length }}</strong>
              draws displayed
            </p>
          </div>

          <svg class="score-line-chart" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" role="img">
            <template v-if="graphMode === 'timeline'">
              <line
                v-for="(_row, index) in displayedRows"
                :key="`draw-guide-${index}`"
                :x1="xForIndex(index)"
                :x2="xForIndex(index)"
                :y1="padding.top"
                :y2="chartHeight - padding.bottom"
                class="score-chart-draw-guide"
              />
            </template>
            <line
              v-for="tick in yTicks"
              :key="`y-${tick}`"
              :x1="padding.left"
              :x2="chartWidth - padding.right"
              :y1="yForValue(tick)"
              :y2="yForValue(tick)"
              class="score-chart-grid"
            />
            <text
              v-for="tick in yTicks"
              :key="`label-${tick}`"
              :x="padding.left - 12"
              :y="yForValue(tick) + 4"
              class="score-chart-label y-label"
            >
              {{ formatAxisTick(tick) }}
            </text>

            <line
              :x1="padding.left"
              :x2="padding.left"
              :y1="padding.top"
              :y2="chartHeight - padding.bottom"
              class="score-chart-axis"
            />
            <line
              :x1="padding.left"
              :x2="chartWidth - padding.right"
              :y1="chartHeight - padding.bottom"
              :y2="chartHeight - padding.bottom"
              class="score-chart-axis"
            />

            <template v-if="graphMode === 'timeline'">
              <g v-for="series in visibleSeries" :key="`mean-${series.id}`">
                <line
                  v-if="meanScores[series.id] !== null"
                  :x1="padding.left"
                  :x2="chartWidth - padding.right"
                  :y1="yForValue(meanScores[series.id] ?? 0)"
                  :y2="yForValue(meanScores[series.id] ?? 0)"
                  class="score-chart-mean-line"
                  :style="{ stroke: series.color }"
                />
              </g>
            </template>

            <g v-for="tick in xTicks" :key="`x-${tick}`">
              <line
                :x1="graphMode === 'sumDistribution' ? xForDistributionIndex(tick) : xForIndex(tick)"
                :x2="graphMode === 'sumDistribution' ? xForDistributionIndex(tick) : xForIndex(tick)"
                :y1="chartHeight - padding.bottom"
                :y2="chartHeight - padding.bottom + 7"
                class="score-chart-axis"
              />
              <text
                :x="graphMode === 'sumDistribution' ? xForDistributionIndex(tick) : xForIndex(tick)"
                :y="chartHeight - padding.bottom + 26"
                class="score-chart-label"
              >
                {{ graphMode === "sumDistribution" ? sumDistribution[tick]?.sum : displayedRows[tick]?.date }}
              </text>
            </g>

            <template v-if="graphMode === 'timeline'">
              <g v-for="series in visibleSeries" :key="`dots-${series.id}`">
                <circle
                  v-for="(row, index) in displayedRows"
                  v-show="row[series.id] !== null"
                  :key="`${series.id}-${row.date}`"
                  :cx="xForIndex(index)"
                  :cy="yForValue(row[series.id] ?? 0)"
                  r="3.2"
                  class="score-chart-dot"
                  :style="{ fill: series.color }"
                />
              </g>
            </template>
            <g v-if="graphMode === 'sumDistribution'">
              <rect
                v-for="(row, index) in sumDistribution"
                :key="`sum-${row.sum}`"
                :x="xForDistributionIndex(index) - distributionBarWidth() / 2"
                :y="yForValue(row.count)"
                :width="distributionBarWidth()"
                :height="chartHeight - padding.bottom - yForValue(row.count)"
                class="score-chart-sum-bar"
              />
            </g>
          </svg>
        </section>
      </div>
    </section>
  </div>
</template>

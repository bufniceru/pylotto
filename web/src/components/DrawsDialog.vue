<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  bayesianMarkovRankingCount,
  buildBayesianMarkovPredictionCoverCounts,
  buildBayesianMarkovPredictionTopPicks,
} from "../lib/bayesianMarkovScore";
import {
  buildCombinedPredictionCoverCounts,
  buildCombinedPredictionTopPicks,
} from "../lib/combinedPrediction";
import {
  buildFreshnessPredictionCoverCounts,
  buildFreshnessPredictionTopPicks,
} from "../lib/freshness";
import {
  buildProximityPredictionCoverCounts,
  buildProximityPredictionTopPicks,
} from "../lib/proximity";
import { buildStructuralEntropyReport } from "../lib/structuralEntropy";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type { EnrichedDraw, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  draws: EnrichedDraw[];
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  closeWorkspaceView: [value: WorkspaceView];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const selectedDrawIndex = ref(Math.max(0, props.draws.length - 1));

const selectedDraw = computed(() => props.draws[selectedDrawIndex.value] ?? null);
const selectedNumbers = computed(
  () => new Set(selectedDraw.value?.numbers.map((number) => number.value) ?? []),
);
const selectedDrawStructuralEntropy = computed(() =>
  buildStructuralEntropyReport(selectedDraw.value?.numbers.map((number) => number.value) ?? []),
);
const displayDrawNumber = computed(() =>
  selectedDraw.value === null ? 0 : selectedDrawIndex.value + 1,
);
const freshnessPredictionCoverCounts = computed(() =>
  buildFreshnessPredictionCoverCounts({ draws: props.draws }),
);
const freshnessPredictionTopPicks = computed(() =>
  buildFreshnessPredictionTopPicks({ draws: props.draws }),
);
const proximityPredictionCoverCounts = computed(() =>
  buildProximityPredictionCoverCounts({ draws: props.draws }),
);
const proximityPredictionTopPicks = computed(() =>
  buildProximityPredictionTopPicks({ draws: props.draws }),
);
const bayesianMarkovPredictionCoverCounts = computed(() =>
  buildBayesianMarkovPredictionCoverCounts({ draws: props.draws }),
);
const bayesianMarkovPredictionTopPicks = computed(() =>
  buildBayesianMarkovPredictionTopPicks({ draws: props.draws }),
);
const combinedPredictionTopPicks = computed(() =>
  buildCombinedPredictionTopPicks({ draws: props.draws }),
);
const coverMeanGroups = computed(() =>
  [6, 5, 4, 3, 2, 1].map((coverSize) => ({
    label: `${coverSize} of 6`,
    summaries: [
      {
        label: "Fr",
        value: meanPredictionCoverCount(
          buildFreshnessPredictionCoverCounts({ draws: props.draws }, coverSize),
        ),
      },
      {
        label: "Pr",
        value: meanPredictionCoverCount(
          buildProximityPredictionCoverCounts({ draws: props.draws }, coverSize),
        ),
      },
      {
        label: "By",
        value: meanPredictionCoverCount(
          buildBayesianMarkovPredictionCoverCounts({ draws: props.draws }, coverSize),
        ),
      },
      {
        label: "Mx",
        value: meanPredictionCoverCount(
          buildCombinedPredictionCoverCounts({ draws: props.draws }, coverSize),
        ),
      },
    ],
  })),
);
watch(
  () => props.draws.length,
  (drawCount) => {
    selectedDrawIndex.value = Math.max(0, drawCount - 1);
  },
);

function setSelectedDrawIndex(index: number): void {
  if (!Number.isInteger(index)) {
    return;
  }

  selectedDrawIndex.value = Math.min(Math.max(index, 0), Math.max(props.draws.length - 1, 0));
}

function showFirstDraw(): void {
  setSelectedDrawIndex(0);
}

function showPreviousDraw(): void {
  setSelectedDrawIndex(selectedDrawIndex.value - 1);
}

function showNextDraw(): void {
  setSelectedDrawIndex(selectedDrawIndex.value + 1);
}

function showLastDraw(): void {
  setSelectedDrawIndex(props.draws.length - 1);
}

function meanPredictionCoverCount(coverCounts: (number | null)[]): number | null {
  const values = coverCounts.filter((coverCount): coverCount is number => coverCount !== null);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatPredictionCoverMean(coverMean: number | null): string {
  return coverMean === null ? "n/a" : `${coverMean.toFixed(1)}/${bayesianMarkovRankingCount()}`;
}

function predictionMethodsForNumber(number: number): string[] {
  const methods: string[] = [];
  const drawIndex = selectedDrawIndex.value;

  if (drawIndex <= 0) {
    return methods;
  }

  if (freshnessPredictionTopPicks.value[drawIndex]?.includes(number)) {
    methods.push("freshness");
  }

  if (proximityPredictionTopPicks.value[drawIndex]?.includes(number)) {
    methods.push("proximity");
  }

  if (bayesianMarkovPredictionTopPicks.value[drawIndex]?.includes(number)) {
    methods.push("bayesian");
  }

  if (combinedPredictionTopPicks.value[drawIndex]?.includes(number)) {
    methods.push("mixed");
  }

  return methods;
}

function predictionFillForNumber(number: number): string | undefined {
  const colors: Record<string, string> = {
    freshness: "#fed7aa",
    proximity: "#bbf7d0",
    bayesian: "#ddd6fe",
    mixed: "#a7f3d0",
  };
  const methods = predictionMethodsForNumber(number);

  if (methods.length === 0) {
    return undefined;
  }

  if (methods.length === 1) {
    return colors[methods[0]];
  }

  const step = 100 / methods.length;
  const stops = methods
    .flatMap((method, index) => [
      `${colors[method]} ${index * step}%`,
      `${colors[method]} ${(index + 1) * step}%`,
    ])
    .join(", ");

  return `conic-gradient(${stops})`;
}

function formatBits(bits: number): string {
  return `${bits.toFixed(2)} bits`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell draws-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @close-workspace-view="emit('closeWorkspaceView', $event)"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <div class="draws-toolbar">
        <button
          class="action-button"
          :disabled="selectedDrawIndex <= 0"
          type="button"
          @click="showFirstDraw"
        >
          First
        </button>
        <button
          class="action-button"
          :disabled="selectedDrawIndex <= 0"
          type="button"
          @click="showPreviousDraw"
        >
          Previous
        </button>
        <p class="reference-pill draws-reference">
          Draw
          <strong>{{ displayDrawNumber }}</strong>
          of
          <strong>{{ draws.length }}</strong>
          <span v-if="selectedDraw">- {{ selectedDraw.date }}</span>
        </p>
        <button
          class="action-button"
          :disabled="selectedDrawIndex >= draws.length - 1"
          type="button"
          @click="showNextDraw"
        >
          Next
        </button>
        <button
          class="action-button"
          :disabled="selectedDrawIndex >= draws.length - 1"
          type="button"
          @click="showLastDraw"
        >
          Last
        </button>
      </div>

      <div class="dialog-body draws-dialog-body draws-history-layout">
        <div class="draw-section draws-detail-section">
          <div class="draw-grid" role="grid" aria-label="Lotto draw numbers">
            <div
              v-for="number in 49"
              :key="number"
              class="draw-cell"
              :class="{
                selected: selectedNumbers.has(number),
                'previous-prediction-hit': predictionMethodsForNumber(number).length > 0,
              }"
              :style="{ '--prediction-fill': predictionFillForNumber(number) }"
              role="gridcell"
            >
              {{ number }}
            </div>
          </div>

          <section
            class="structural-entropy-report"
            aria-label="Selected draw structural entropy report"
          >
            <div class="structural-report-header">
              <div>
                <p class="structural-report-kicker">Entropy</p>
                <h3>{{ selectedDrawStructuralEntropy.complexityLabel }}</h3>
              </div>
              <div class="structural-score">
                <strong>{{ formatBits(selectedDrawStructuralEntropy.structuralBits) }}</strong>
                <span>{{ formatPercent(selectedDrawStructuralEntropy.structuralPercent) }} of fair-draw bits</span>
              </div>
            </div>

            <p class="structural-summary">{{ selectedDrawStructuralEntropy.summary }}</p>

            <div class="structural-metrics" aria-label="Structural metrics">
              <div>
                <span>Fair draw</span>
                <strong>{{ formatBits(selectedDrawStructuralEntropy.exactLotteryBits) }}</strong>
              </div>
              <div>
                <span>Selected lens</span>
                <strong>{{ selectedDrawStructuralEntropy.selectedLensLabel }}</strong>
              </div>
              <div>
                <span>Sum</span>
                <strong>{{ selectedDrawStructuralEntropy.metrics.sum }}</strong>
              </div>
              <div>
                <span>Span</span>
                <strong>{{ selectedDrawStructuralEntropy.metrics.span }}</strong>
              </div>
              <div>
                <span>Gaps</span>
                <strong>{{ selectedDrawStructuralEntropy.metrics.gaps.join(", ") }}</strong>
              </div>
              <div>
                <span>Odd / even</span>
                <strong>
                  {{ selectedDrawStructuralEntropy.metrics.oddCount }} /
                  {{ selectedDrawStructuralEntropy.metrics.evenCount }}
                </strong>
              </div>
            </div>

            <div class="structural-report-columns">
              <section class="structural-panel">
                <h4>Encoding Lenses</h4>
                <ul class="structural-lens-list">
                  <li
                    v-for="lens in selectedDrawStructuralEntropy.lenses"
                    :key="lens.id"
                    :class="{ selected: lens.selected }"
                  >
                    <div>
                      <strong>{{ lens.label }}</strong>
                      <span>{{ lens.detail }}</span>
                    </div>
                    <b>{{ formatBits(lens.bits) }}</b>
                  </li>
                </ul>
              </section>

              <section class="structural-panel">
                <h4>Pattern Factors</h4>
                <ul class="structural-factor-list">
                  <li
                    v-for="factor in selectedDrawStructuralEntropy.factors"
                    :key="factor.label"
                    :class="factor.impact"
                  >
                    <div>
                      <strong>{{ factor.label }}: {{ factor.value }}</strong>
                      <span>{{ factor.explanation }}</span>
                    </div>
                  </li>
                </ul>
              </section>
            </div>

            <section class="structural-panel structural-notes">
              <h4>Implementation Notes</h4>
              <p v-for="note in selectedDrawStructuralEntropy.notes" :key="note">
                {{ note }}
              </p>
            </section>
          </section>

          <section class="structural-panel cover-means-panel" aria-label="Prediction cover means">
            <h4>Cover Means</h4>
            <div class="cover-means-groups">
              <div v-for="group in coverMeanGroups" :key="group.label" class="cover-means-group">
                <span class="cover-means-group-label">{{ group.label }}</span>
                <div class="cover-means-grid">
                  <div v-for="summary in group.summaries" :key="`${group.label}-${summary.label}`">
                    <span>{{ summary.label }}</span>
                    <strong>{{ formatPredictionCoverMean(summary.value) }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

      </div>
    </section>
  </div>
</template>

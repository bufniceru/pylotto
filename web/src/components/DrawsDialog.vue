<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  bayesianMarkovRankingCount,
  buildBayesianMarkovPredictionCoverCounts,
  buildBayesianMarkovPredictionScores,
} from "../lib/bayesianMarkovScore";
import {
  buildFreshnessPredictionCoverCounts,
  buildFreshnessPredictionScores,
} from "../lib/freshness";
import {
  buildProximityPredictionCoverCounts,
  buildProximityPredictionScores,
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
  switchWorkspaceView: [value: WorkspaceView];
}>();

const selectedDrawIndex = ref(Math.max(0, props.draws.length - 1));
const selectedDrawRow = ref<HTMLTableRowElement | null>(null);

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
const freshnessPredictionScores = computed(() =>
  buildFreshnessPredictionScores({ draws: props.draws }),
);
const freshnessPredictionCoverCounts = computed(() =>
  buildFreshnessPredictionCoverCounts({ draws: props.draws }),
);
const proximityPredictionScores = computed(() =>
  buildProximityPredictionScores({ draws: props.draws }),
);
const proximityPredictionCoverCounts = computed(() =>
  buildProximityPredictionCoverCounts({ draws: props.draws }),
);
const bayesianMarkovPredictionScores = computed(() =>
  buildBayesianMarkovPredictionScores({ draws: props.draws }),
);
const bayesianMarkovPredictionCoverCounts = computed(() =>
  buildBayesianMarkovPredictionCoverCounts({ draws: props.draws }),
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
    ],
  })),
);
const tableDraws = computed(() =>
  props.draws
    .map((draw, index) => ({
      draw,
      index,
      freshnessPredictionScore: freshnessPredictionScores.value[index] ?? null,
      freshnessPredictionCoverCount: freshnessPredictionCoverCounts.value[index] ?? null,
      proximityPredictionScore: proximityPredictionScores.value[index] ?? null,
      proximityPredictionCoverCount: proximityPredictionCoverCounts.value[index] ?? null,
      bayesianMarkovPredictionScore: bayesianMarkovPredictionScores.value[index] ?? null,
      bayesianMarkovPredictionCoverCount: bayesianMarkovPredictionCoverCounts.value[index] ?? null,
    }))
    .sort((left, right) => right.draw.date.localeCompare(left.draw.date)),
);

watch(
  () => props.draws.length,
  (drawCount) => {
    selectedDrawIndex.value = Math.max(0, drawCount - 1);
    void scrollSelectedDrawIntoView();
  },
);

watch(selectedDrawIndex, () => {
  void scrollSelectedDrawIntoView();
});

async function scrollSelectedDrawIntoView(): Promise<void> {
  await nextTick();
  selectedDrawRow.value?.scrollIntoView({ block: "nearest" });
}

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

function formatPredictionScore(score: number | null): string {
  return score === null ? "n/a" : `${score.toFixed(1)}%`;
}

function formatPredictionCoverCount(coverCount: number | null): string {
  return coverCount === null ? "n/a" : `${coverCount}/${bayesianMarkovRankingCount()}`;
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
              :class="{ selected: selectedNumbers.has(number) }"
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

        <aside class="draws-table-panel" aria-label="All draws">
          <table class="draws-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Date</th>
                <th>Numbers</th>
                <th title="How strongly the actual draw matched the freshness prediction generated from previous draws only.">
                  Fr %
                </th>
                <th title="How many previous freshness-ranked picks you would need to play to include all six numbers in this draw.">
                  Fr Cover
                </th>
                <th title="How strongly the actual draw matched the proximity prediction generated from previous draws only.">
                  Pr %
                </th>
                <th title="How many previous proximity-ranked picks you would need to play to include all six numbers in this draw.">
                  Pr Cover
                </th>
                <th title="How strongly the actual draw matched the Bayesian Markov prediction generated from previous draws only.">
                  By %
                </th>
                <th title="How many previous Bayesian-ranked picks you would need to play to include all six numbers in this draw.">
                  By Cover
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="{ draw, index, freshnessPredictionScore, freshnessPredictionCoverCount, proximityPredictionScore, proximityPredictionCoverCount, bayesianMarkovPredictionScore, bayesianMarkovPredictionCoverCount } in tableDraws"
                :key="draw.date"
                :ref="(element) => {
                  if (index === selectedDrawIndex) {
                    selectedDrawRow = element as HTMLTableRowElement;
                  }
                }"
                :class="{ selected: selectedDrawIndex === index }"
                tabindex="0"
                @click="setSelectedDrawIndex(index)"
                @keydown.enter.prevent="setSelectedDrawIndex(index)"
                @keydown.space.prevent="setSelectedDrawIndex(index)"
              >
                <td>{{ index + 1 }}</td>
                <td>{{ draw.date }}</td>
                <td>{{ draw.numbers.map((number) => number.value).join(", ") }}</td>
                <td>{{ formatPredictionScore(freshnessPredictionScore) }}</td>
                <td>{{ formatPredictionCoverCount(freshnessPredictionCoverCount) }}</td>
                <td>{{ formatPredictionScore(proximityPredictionScore) }}</td>
                <td>{{ formatPredictionCoverCount(proximityPredictionCoverCount) }}</td>
                <td>{{ formatPredictionScore(bayesianMarkovPredictionScore) }}</td>
                <td>{{ formatPredictionCoverCount(bayesianMarkovPredictionCoverCount) }}</td>
              </tr>
            </tbody>
          </table>
        </aside>
      </div>
    </section>
  </div>
</template>

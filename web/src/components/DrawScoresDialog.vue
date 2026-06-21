<script setup lang="ts">
import { computed } from "vue";
import {
  buildBayesianMarkovPredictionCoverCounts,
  buildBayesianMarkovPredictionScores,
  buildBayesianMarkovPredictionTopPicks,
} from "../lib/bayesianMarkovScore";
import {
  buildFreshnessPredictionCoverCounts,
  buildFreshnessPredictionScores,
  buildFreshnessPredictionTopPicks,
} from "../lib/freshness";
import {
  buildProximityPredictionCoverCounts,
  buildProximityPredictionScores,
  buildProximityPredictionTopPicks,
} from "../lib/proximity";
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

const freshnessPredictionScores = computed(() =>
  buildFreshnessPredictionScores({ draws: props.draws }),
);
const freshnessPredictionCoverCounts = computed(() =>
  buildFreshnessPredictionCoverCounts({ draws: props.draws }),
);
const freshnessPredictionTopPicks = computed(() =>
  buildFreshnessPredictionTopPicks({ draws: props.draws }),
);
const proximityPredictionScores = computed(() =>
  buildProximityPredictionScores({ draws: props.draws }),
);
const proximityPredictionCoverCounts = computed(() =>
  buildProximityPredictionCoverCounts({ draws: props.draws }),
);
const proximityPredictionTopPicks = computed(() =>
  buildProximityPredictionTopPicks({ draws: props.draws }),
);
const bayesianMarkovPredictionScores = computed(() =>
  buildBayesianMarkovPredictionScores({ draws: props.draws }),
);
const bayesianMarkovPredictionCoverCounts = computed(() =>
  buildBayesianMarkovPredictionCoverCounts({ draws: props.draws }),
);
const bayesianMarkovPredictionTopPicks = computed(() =>
  buildBayesianMarkovPredictionTopPicks({ draws: props.draws }),
);
const tableDraws = computed(() =>
  props.draws
    .map((draw, index) => ({
      draw,
      index,
      freshnessPredictionScore: freshnessPredictionScores.value[index] ?? null,
      freshnessPredictionHits: predictionHitCount(
        draw,
        freshnessPredictionTopPicks.value[index] ?? null,
      ),
      freshnessPredictionCoverCount: freshnessPredictionCoverCounts.value[index] ?? null,
      proximityPredictionScore: proximityPredictionScores.value[index] ?? null,
      proximityPredictionHits: predictionHitCount(
        draw,
        proximityPredictionTopPicks.value[index] ?? null,
      ),
      proximityPredictionCoverCount: proximityPredictionCoverCounts.value[index] ?? null,
      bayesianMarkovPredictionScore: bayesianMarkovPredictionScores.value[index] ?? null,
      bayesianMarkovPredictionHits: predictionHitCount(
        draw,
        bayesianMarkovPredictionTopPicks.value[index] ?? null,
      ),
      bayesianMarkovPredictionCoverCount: bayesianMarkovPredictionCoverCounts.value[index] ?? null,
    }))
    .sort((left, right) => right.draw.date.localeCompare(left.draw.date)),
);

function predictionHitCount(draw: EnrichedDraw, topPicks: number[] | null): number | null {
  if (topPicks === null) {
    return null;
  }

  const pickedNumbers = new Set(topPicks);

  return draw.numbers.filter((number) => pickedNumbers.has(number.value)).length;
}

function formatPredictionScore(score: number | null): string {
  return score === null ? "n/a" : `${score.toFixed(1)}%`;
}

function formatPredictionHits(hitCount: number | null): string {
  return hitCount === null ? "n/a" : `${hitCount}/6`;
}

function formatPredictionCoverCount(coverCount: number | null): string {
  return coverCount === null ? "n/a" : `${coverCount}/49`;
}
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell all-draws-dialog-shell draw-scores-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <div class="all-draws-toolbar">
        <p class="reference-pill">
          Historical draws
          <strong>{{ draws.length }}</strong>
        </p>
      </div>

      <div class="dialog-body all-draws-body">
        <div class="all-draws-table-panel draw-scores-table-panel">
          <table class="draws-table all-draws-table draw-scores-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Date</th>
                <th>Numbers</th>
                <th title="How strongly the actual draw matched the freshness prediction generated from previous draws only.">
                  Fr %
                </th>
                <th title="How many actual draw numbers appeared in the previous freshness top-six picks.">
                  Fr Hits
                </th>
                <th title="How many previous freshness-ranked picks you would need to play to include all six numbers in this draw.">
                  Fr Cover
                </th>
                <th title="How strongly the actual draw matched the proximity prediction generated from previous draws only.">
                  Pr %
                </th>
                <th title="How many actual draw numbers appeared in the previous proximity top-six picks.">
                  Pr Hits
                </th>
                <th title="How many previous proximity-ranked picks you would need to play to include all six numbers in this draw.">
                  Pr Cover
                </th>
                <th title="How strongly the actual draw matched the Bayesian Markov prediction generated from previous draws only.">
                  By %
                </th>
                <th title="How many actual draw numbers appeared in the previous Bayesian top-six picks.">
                  By Hits
                </th>
                <th title="How many previous Bayesian-ranked picks you would need to play to include all six numbers in this draw.">
                  By Cover
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="{ draw, index, freshnessPredictionScore, freshnessPredictionHits, freshnessPredictionCoverCount, proximityPredictionScore, proximityPredictionHits, proximityPredictionCoverCount, bayesianMarkovPredictionScore, bayesianMarkovPredictionHits, bayesianMarkovPredictionCoverCount } in tableDraws"
                :key="draw.date"
              >
                <td>{{ index + 1 }}</td>
                <td>{{ draw.date }}</td>
                <td>{{ draw.numbers.map((number) => number.value).join(", ") }}</td>
                <td>{{ formatPredictionScore(freshnessPredictionScore) }}</td>
                <td>{{ formatPredictionHits(freshnessPredictionHits) }}</td>
                <td>{{ formatPredictionCoverCount(freshnessPredictionCoverCount) }}</td>
                <td>{{ formatPredictionScore(proximityPredictionScore) }}</td>
                <td>{{ formatPredictionHits(proximityPredictionHits) }}</td>
                <td>{{ formatPredictionCoverCount(proximityPredictionCoverCount) }}</td>
                <td>{{ formatPredictionScore(bayesianMarkovPredictionScore) }}</td>
                <td>{{ formatPredictionHits(bayesianMarkovPredictionHits) }}</td>
                <td>{{ formatPredictionCoverCount(bayesianMarkovPredictionCoverCount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

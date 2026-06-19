<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import DrawsDialog from "./components/DrawsDialog.vue";
import FreshnessReportDialog from "./components/FreshnessReportDialog.vue";
import LastSeenDifferenceHighlightDialog from "./components/LastSeenDifferenceHighlightDialog.vue";
import LastSeenGapHighlightDialog from "./components/LastSeenGapHighlightDialog.vue";
import LastSeenHighlightDialog from "./components/LastSeenHighlightDialog.vue";
import MarkovScoreReportDialog from "./components/MarkovScoreReportDialog.vue";
import NextPossibleDrawDialog from "./components/NextPossibleDrawDialog.vue";
import ProximityReportDialog from "./components/ProximityReportDialog.vue";
import { buildFreshnessModel } from "./lib/freshness";
import { buildHistory } from "./lib/history";
import { buildLastSeenDifferenceHighlightModel } from "./lib/lastSeenDifferenceHighlight";
import { buildLastSeenGapHighlightModel } from "./lib/lastSeenGapHighlight";
import { buildLastSeenHighlightModel } from "./lib/lastSeenHighlight";
import { buildMarkovScoreModel } from "./lib/markovScore";
import { buildProximityModel } from "./lib/proximity";
import type { EnrichedHistory, HighlightView, RawHistory, WorkspaceTab, WorkspaceView } from "./types";

const rawHistory = ref<RawHistory | null>(null);
const history = ref<EnrichedHistory>({ draws: [] });
const isLoading = ref(true);
const loadError = ref<string | null>(null);

const isHighlightViewsOpen = ref(false);
const isFreshnessReportOpen = ref(false);
const isProximityReportOpen = ref(false);
const isMarkovScoreReportOpen = ref(false);
const activeHighlightView = ref<HighlightView>("number");
const isDrawsOpen = ref(false);
const isNextPossibleDrawOpen = ref(false);
const openWorkspaceViews = ref<WorkspaceView[]>([]);
const activeWorkspaceView = ref<WorkspaceView | null>(null);
const drawCount = ref(1);
const referenceDrawOffset = ref(0);
const gapDrawCount = ref(1);
const gapReferenceDrawOffset = ref(0);
const differenceDrawCount = ref(1);
const differenceReferenceDrawOffset = ref(0);
const statisticsReferenceDrawOffset = ref(0);

const totalDraws = computed(() => history.value.draws.length);
const maxStatisticsReferenceDrawOffset = computed(() => Math.max(totalDraws.value - 1, 0));
const statisticsReferenceHistory = computed<EnrichedHistory>(() => {
  if (statisticsReferenceDrawOffset.value <= 0) {
    return history.value;
  }

  return {
    draws: history.value.draws.slice(0, -statisticsReferenceDrawOffset.value),
  };
});
const workspaceLabels: Record<WorkspaceView, string> = {
  draws: "Draws",
  nextPossibleDraw: "Next Possible Draw",
  highlights: "Highlights",
  freshness: "Freshness",
  proximity: "Proximity",
  markovScore: "100 Markov Score",
};
const workspaceTabs = computed<WorkspaceTab[]>(() =>
  openWorkspaceViews.value.map((id) => ({
    id,
    label: workspaceLabels[id],
  })),
);

const model = computed(() =>
  buildLastSeenHighlightModel(history.value, drawCount.value, referenceDrawOffset.value),
);
const lastSeenLast50Model = computed(() =>
  buildLastSeenHighlightModel(history.value, Math.min(50, totalDraws.value), 0),
);
const gapModel = computed(() =>
  buildLastSeenGapHighlightModel(
    history.value,
    gapDrawCount.value,
    gapReferenceDrawOffset.value,
  ),
);
const lastSeenGapLast50Model = computed(() =>
  buildLastSeenGapHighlightModel(history.value, Math.min(50, totalDraws.value), 0),
);
const differenceModel = computed(() =>
  buildLastSeenDifferenceHighlightModel(
    history.value,
    differenceDrawCount.value,
    differenceReferenceDrawOffset.value,
  ),
);
const lastSeenDifferenceLast50Model = computed(() =>
  buildLastSeenDifferenceHighlightModel(history.value, Math.min(50, totalDraws.value), 0),
);
const freshnessModel = computed(() => buildFreshnessModel(statisticsReferenceHistory.value));
const proximityModel = computed(() => buildProximityModel(statisticsReferenceHistory.value));
const markovScoreModel = computed(() => buildMarkovScoreModel(statisticsReferenceHistory.value));

function openLastSeenHighlight(): void {
  activeHighlightView.value = "number";
  openWorkspaceView("highlights");
}

function openLastSeenGapHighlight(): void {
  activeHighlightView.value = "gap";
  openWorkspaceView("highlights");
}

function openLastSeenDifferenceHighlight(): void {
  activeHighlightView.value = "difference";
  openWorkspaceView("highlights");
}

function openDraws(): void {
  openWorkspaceView("draws");
}

function openNextPossibleDraw(): void {
  openWorkspaceView("nextPossibleDraw");
}

function openFreshnessReport(): void {
  openWorkspaceView("freshness");
}

function openProximityReport(): void {
  openWorkspaceView("proximity");
}

function openMarkovScoreReport(): void {
  openWorkspaceView("markovScore");
}

function syncWorkspaceFlags(): void {
  isDrawsOpen.value = activeWorkspaceView.value === "draws";
  isNextPossibleDrawOpen.value = activeWorkspaceView.value === "nextPossibleDraw";
  isHighlightViewsOpen.value = activeWorkspaceView.value === "highlights";
  isFreshnessReportOpen.value = activeWorkspaceView.value === "freshness";
  isProximityReportOpen.value = activeWorkspaceView.value === "proximity";
  isMarkovScoreReportOpen.value = activeWorkspaceView.value === "markovScore";
}

function openWorkspaceView(view: WorkspaceView): void {
  if (!openWorkspaceViews.value.includes(view)) {
    openWorkspaceViews.value = [...openWorkspaceViews.value, view];
  }

  activeWorkspaceView.value = view;
  syncWorkspaceFlags();
}

function switchWorkspaceView(view: WorkspaceView): void {
  if (!openWorkspaceViews.value.includes(view)) {
    return;
  }

  activeWorkspaceView.value = view;
  syncWorkspaceFlags();
}

function closeActiveWorkspaceView(): void {
  const activeView = activeWorkspaceView.value;

  if (activeView === null) {
    return;
  }

  const remainingViews = openWorkspaceViews.value.filter((view) => view !== activeView);
  openWorkspaceViews.value = remainingViews;
  activeWorkspaceView.value = remainingViews[remainingViews.length - 1] ?? null;
  syncWorkspaceFlags();
}

function updateDrawCount(value: number): void {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.min(Math.max(Math.trunc(value), 1), totalDraws.value);
  drawCount.value = normalized;
  referenceDrawOffset.value = Math.min(referenceDrawOffset.value, normalized - 1);
}

function updateGapDrawCount(value: number): void {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.min(Math.max(Math.trunc(value), 1), totalDraws.value);
  gapDrawCount.value = normalized;
  gapReferenceDrawOffset.value = Math.min(gapReferenceDrawOffset.value, normalized - 1);
}

function updateDifferenceDrawCount(value: number): void {
  if (!Number.isFinite(value)) {
    return;
  }

  const normalized = Math.min(Math.max(Math.trunc(value), 1), totalDraws.value);
  differenceDrawCount.value = normalized;
  differenceReferenceDrawOffset.value = Math.min(
    differenceReferenceDrawOffset.value,
    normalized - 1,
  );
}

function showPreviousDraw(): void {
  referenceDrawOffset.value = Math.min(
    referenceDrawOffset.value + 1,
    model.value.maxReferenceOffset,
  );
}

function showFirstDraw(): void {
  referenceDrawOffset.value = model.value.maxReferenceOffset;
}

function showLatestDraw(): void {
  referenceDrawOffset.value = 0;
}

function showPreviousGapDraw(): void {
  gapReferenceDrawOffset.value = Math.min(
    gapReferenceDrawOffset.value + 1,
    gapModel.value.maxReferenceOffset,
  );
}

function showFirstGapDraw(): void {
  gapReferenceDrawOffset.value = gapModel.value.maxReferenceOffset;
}

function showLatestGapDraw(): void {
  gapReferenceDrawOffset.value = 0;
}

function showPreviousDifferenceDraw(): void {
  differenceReferenceDrawOffset.value = Math.min(
    differenceReferenceDrawOffset.value + 1,
    differenceModel.value.maxReferenceOffset,
  );
}

function showFirstDifferenceDraw(): void {
  differenceReferenceDrawOffset.value = differenceModel.value.maxReferenceOffset;
}

function showLatestDifferenceDraw(): void {
  differenceReferenceDrawOffset.value = 0;
}

function showNextDraw(): void {
  referenceDrawOffset.value = Math.max(referenceDrawOffset.value - 1, 0);
}

function showNextGapDraw(): void {
  gapReferenceDrawOffset.value = Math.max(gapReferenceDrawOffset.value - 1, 0);
}

function showNextDifferenceDraw(): void {
  differenceReferenceDrawOffset.value = Math.max(differenceReferenceDrawOffset.value - 1, 0);
}

function showPreviousStatisticsReferenceDraw(): void {
  statisticsReferenceDrawOffset.value = Math.min(
    statisticsReferenceDrawOffset.value + 1,
    maxStatisticsReferenceDrawOffset.value,
  );
}

function showFirstStatisticsReferenceDraw(): void {
  statisticsReferenceDrawOffset.value = maxStatisticsReferenceDrawOffset.value;
}

function showNextStatisticsReferenceDraw(): void {
  statisticsReferenceDrawOffset.value = Math.max(statisticsReferenceDrawOffset.value - 1, 0);
}

function showLatestStatisticsReferenceDraw(): void {
  statisticsReferenceDrawOffset.value = 0;
}

let unsubscribeMenuAction: (() => void) | null = null;

onMounted(() => {
  window.pylottoDesktop
    ?.loadLottoHistory()
    .then((payload) => {
      rawHistory.value = payload;
      history.value = buildHistory(payload);
      drawCount.value = Math.min(250, history.value.draws.length);
      gapDrawCount.value = Math.min(250, history.value.draws.length);
      differenceDrawCount.value = Math.min(250, history.value.draws.length);
      referenceDrawOffset.value = 0;
      gapReferenceDrawOffset.value = 0;
      differenceReferenceDrawOffset.value = 0;
      statisticsReferenceDrawOffset.value = 0;
    })
    .catch((error: unknown) => {
      loadError.value =
        error instanceof Error ? error.message : "Could not load lotto YAML data.";
    })
    .finally(() => {
      isLoading.value = false;
    });

  unsubscribeMenuAction =
    window.pylottoDesktop?.onMenuAction((message) => {
      if (message.action === "openLastSeenHighlight") {
        openLastSeenHighlight();
      }

      if (message.action === "openLastSeenGapHighlight") {
        openLastSeenGapHighlight();
      }

      if (message.action === "openLastSeenDifferenceHighlight") {
        openLastSeenDifferenceHighlight();
      }

      if (message.action === "openDraws") {
        openDraws();
      }

      if (message.action === "openNextPossibleDraw") {
        openNextPossibleDraw();
      }

      if (message.action === "openFreshnessReport") {
        openFreshnessReport();
      }

      if (message.action === "openProximityReport") {
        openProximityReport();
      }

      if (message.action === "openMarkovScoreReport") {
        openMarkovScoreReport();
      }
    }) ?? null;
});

onBeforeUnmount(() => {
  unsubscribeMenuAction?.();
});
</script>

<template>
  <main class="app-shell">
    <section class="hero-panel">
      <p class="eyebrow">Electron + Vue Port</p>
      <h1>PyLotto Statistics Workspace</h1>
      <p v-if="isLoading" class="hero-copy">
        Loading lotto draws from the YAML file bundled with the Electron app.
      </p>
      <p v-else-if="loadError" class="hero-copy">
        {{ loadError }}
      </p>
      <p v-else class="hero-copy">
        The desktop shell now runs on Electron with Vue. Use the menu path
        <strong>File / Draws</strong>
        to browse draws, or
        <strong>File / Planning / Next Possible Draw</strong>
        to set the next possible draw, or
        <strong>Statistics / Views / Last Seen Highlight</strong>
        or
        <strong>Statistics / Views / Last Seen Gap Highlight</strong>
        or
        <strong>Statistics / Views / Last Seen Difference Highlight</strong>
        or
        <strong>Statistics / Views / Freshness Report</strong>
        or
        <strong>Statistics / Views / Proximity Report</strong>
        or
        <strong>Statistics / Views / 100 Markov Score</strong>
        to open runtime YAML-driven statistics dialogs.
      </p>

      <div class="hero-actions">
        <button
          class="action-button primary"
          :disabled="isLoading || !!loadError || totalDraws === 0"
          type="button"
          @click="openDraws"
        >
          Open Draws
        </button>
        <button
          class="action-button"
          :disabled="isLoading || !!loadError || totalDraws === 0"
          type="button"
          @click="openNextPossibleDraw"
        >
          Next Possible Draw
        </button>
        <button
          class="action-button"
          :disabled="isLoading || !!loadError || totalDraws === 0"
          type="button"
          @click="openLastSeenHighlight"
        >
          Open Last Seen Highlight
        </button>
        <button
          class="action-button"
          :disabled="isLoading || !!loadError || totalDraws === 0"
          type="button"
          @click="openLastSeenGapHighlight"
        >
          Open Last Seen Gap Highlight
        </button>
        <button
          class="action-button"
          :disabled="isLoading || !!loadError || totalDraws === 0"
          type="button"
          @click="openLastSeenDifferenceHighlight"
        >
          Open Last Seen Difference Highlight
        </button>
        <button
          class="action-button"
          :disabled="isLoading || !!loadError || totalDraws === 0"
          type="button"
          @click="openFreshnessReport"
        >
          Open Freshness Report
        </button>
        <button
          class="action-button"
          :disabled="isLoading || !!loadError || totalDraws === 0"
          type="button"
          @click="openProximityReport"
        >
          Open Proximity Report
        </button>
        <button
          class="action-button"
          :disabled="isLoading || !!loadError || totalDraws === 0"
          type="button"
          @click="openMarkovScoreReport"
        >
          Open 100 Markov Score
        </button>
      </div>

      <dl class="meta-grid">
        <div>
          <dt>Total draws</dt>
          <dd>{{ totalDraws }}</dd>
        </div>
        <div>
          <dt>First draw</dt>
          <dd>{{ rawHistory?.firstDraw ?? "n/a" }}</dd>
        </div>
        <div>
          <dt>Last draw</dt>
          <dd>{{ rawHistory?.lastDraw ?? "n/a" }}</dd>
        </div>
      </dl>
    </section>

    <DrawsDialog
      v-if="isDrawsOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'draws'"
      :draws="history.draws"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @switch-workspace-view="switchWorkspaceView"
    />

    <NextPossibleDrawDialog
      v-if="isNextPossibleDrawOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'nextPossibleDraw'"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @switch-workspace-view="switchWorkspaceView"
    />

    <LastSeenHighlightDialog
      v-if="isHighlightViewsOpen && activeHighlightView === 'number' && !isLoading && !loadError"
      :active-view="activeHighlightView"
      :active-workspace-view="activeWorkspaceView ?? 'highlights'"
      :draw-count="totalDraws"
      :draw-count-value="drawCount"
      :last-50-model="lastSeenLast50Model"
      :model="model"
      :reference-draw-offset="referenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @first-draw="showFirstDraw"
      @latest-draw="showLatestDraw"
      @next-draw="showNextDraw"
      @previous-draw="showPreviousDraw"
      @switch-view="activeHighlightView = $event"
      @switch-workspace-view="switchWorkspaceView"
      @update-draw-count="updateDrawCount"
    />

    <LastSeenGapHighlightDialog
      v-if="isHighlightViewsOpen && activeHighlightView === 'gap' && !isLoading && !loadError"
      :active-view="activeHighlightView"
      :active-workspace-view="activeWorkspaceView ?? 'highlights'"
      :draw-count="totalDraws"
      :draw-count-value="gapDrawCount"
      :last-50-model="lastSeenGapLast50Model"
      :model="gapModel"
      :reference-draw-offset="gapReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @first-draw="showFirstGapDraw"
      @latest-draw="showLatestGapDraw"
      @next-draw="showNextGapDraw"
      @previous-draw="showPreviousGapDraw"
      @switch-view="activeHighlightView = $event"
      @switch-workspace-view="switchWorkspaceView"
      @update-draw-count="updateGapDrawCount"
    />

    <LastSeenDifferenceHighlightDialog
      v-if="isHighlightViewsOpen && activeHighlightView === 'difference' && !isLoading && !loadError"
      :active-view="activeHighlightView"
      :active-workspace-view="activeWorkspaceView ?? 'highlights'"
      :draw-count="totalDraws"
      :draw-count-value="differenceDrawCount"
      :last-50-model="lastSeenDifferenceLast50Model"
      :model="differenceModel"
      :reference-draw-offset="differenceReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @first-draw="showFirstDifferenceDraw"
      @latest-draw="showLatestDifferenceDraw"
      @next-draw="showNextDifferenceDraw"
      @previous-draw="showPreviousDifferenceDraw"
      @switch-view="activeHighlightView = $event"
      @switch-workspace-view="switchWorkspaceView"
      @update-draw-count="updateDifferenceDrawCount"
    />

    <FreshnessReportDialog
      v-if="isFreshnessReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'freshness'"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :model="freshnessModel"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />

    <ProximityReportDialog
      v-if="isProximityReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'proximity'"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :model="proximityModel"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />

    <MarkovScoreReportDialog
      v-if="isMarkovScoreReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'markovScore'"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :model="markovScoreModel"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />
  </main>
</template>

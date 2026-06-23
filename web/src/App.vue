<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AllDrawsDialog from "./components/AllDrawsDialog.vue";
import AutocorrelationReportDialog from "./components/AutocorrelationReportDialog.vue";
import BayesianMarkovReportDialog from "./components/BayesianMarkovReportDialog.vue";
import ChiSquareReportDialog from "./components/ChiSquareReportDialog.vue";
import CoOccurrenceReportDialog from "./components/CoOccurrenceReportDialog.vue";
import DrawsDialog from "./components/DrawsDialog.vue";
import DrawScoresDialog from "./components/DrawScoresDialog.vue";
import EntropyReportDialog from "./components/EntropyReportDialog.vue";
import FreshnessReportDialog from "./components/FreshnessReportDialog.vue";
import LastSeenDifferenceHighlightDialog from "./components/LastSeenDifferenceHighlightDialog.vue";
import LastSeenGapHighlightDialog from "./components/LastSeenGapHighlightDialog.vue";
import LastSeenHighlightDialog from "./components/LastSeenHighlightDialog.vue";
import MarkovScoreReportDialog from "./components/MarkovScoreReportDialog.vue";
import MixedPredictionReportDialog from "./components/MixedPredictionReportDialog.vue";
import NextPossibleDrawDialog from "./components/NextPossibleDrawDialog.vue";
import ProximityReportDialog from "./components/ProximityReportDialog.vue";
import ScoreGraphsDialog from "./components/ScoreGraphsDialog.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import { buildAutocorrelationModel } from "./lib/autocorrelation";
import { buildChiSquareModel } from "./lib/chiSquare";
import { buildCoOccurrenceModel } from "./lib/coOccurrence";
import { buildFreshnessModel } from "./lib/freshness";
import { buildHistory } from "./lib/history";
import { buildLastSeenDifferenceHighlightModel } from "./lib/lastSeenDifferenceHighlight";
import { buildLastSeenGapHighlightModel } from "./lib/lastSeenGapHighlight";
import { buildLastSeenHighlightModel } from "./lib/lastSeenHighlight";
import { buildMarkovScoreModel } from "./lib/markovScore";
import { buildProximityModel } from "./lib/proximity";
import type {
  AppSettings,
  EnrichedHistory,
  HighlightView,
  RawHistory,
  WorkspaceTab,
  WorkspaceView,
} from "./types";

interface AuthUser {
  email: string;
}

const rawHistory = ref<RawHistory | null>(null);
const history = ref<EnrichedHistory>({ draws: [] });
const isLoading = ref(true);
const loadError = ref<string | null>(null);
const authChecked = ref(false);
const authEmail = ref("");
const authError = ref("");
const authMode = ref<"login" | "register">("login");
const authPassword = ref("");
const authUser = ref<AuthUser | null>(null);
const isAuthenticating = ref(false);
const appSettings = ref<AppSettings>({ implementLawOfLargeNumbers: false });
const isSettingsOpen = ref(false);

const isHighlightViewsOpen = ref(false);
const isEntropyReportOpen = ref(false);
const isFreshnessReportOpen = ref(false);
const isProximityReportOpen = ref(false);
const isChiSquareReportOpen = ref(false);
const isAutocorrelationReportOpen = ref(false);
const isCoOccurrenceReportOpen = ref(false);
const isMarkovScoreReportOpen = ref(false);
const isBayesianMarkovReportOpen = ref(false);
const isMixedPredictionReportOpen = ref(false);
const isScoreGraphsOpen = ref(false);
const activeHighlightView = ref<HighlightView>("number");
const isDrawsOpen = ref(false);
const isDrawScoresOpen = ref(false);
const isAllDrawsOpen = ref(false);
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
const statisticsNextActualDraw = computed(() => {
  const nextDrawIndex = statisticsReferenceHistory.value.draws.length;

  return history.value.draws[nextDrawIndex] ?? null;
});
const workspaceLabels: Record<WorkspaceView, string> = {
  draws: "Draws",
  drawScores: "Draw Scores",
  allDraws: "All Draws",
  nextPossibleDrawPossible: "Possible Draw",
  nextPossibleDrawScoreGrid: "Predictive Score Grid",
  nextPossibleDrawReal: "Real Draw",
  lastSeenHighlight: "Last Seen Highlight",
  lastSeenGapHighlight: "Last Seen Gap Highlight",
  lastSeenDifferenceHighlight: "Last Seen Difference Highlight",
  entropy: "Entropy Report",
  freshness: "Freshness",
  proximity: "Proximity",
  chiSquare: "Chi-square",
  autocorrelation: "Autocorrelation",
  coOccurrence: "Co-occurrence",
  markovScore: "100 Markov Score",
  bayesianMarkov: "Bayesian Markov",
  mixedPrediction: "Mixed Prediction",
  scoreGraphs: "Score Graphs",
};
const workspaceTabs = computed<WorkspaceTab[]>(() =>
  openWorkspaceViews.value.map((id) => ({
    id,
    label: workspaceLabels[id],
  })),
);
const workspaceBreadcrumbs: Record<WorkspaceView, string[]> = {
  draws: ["File", "Draws"],
  drawScores: ["File", "Draws", "Draw Scores"],
  allDraws: ["File", "Draws", "All Draws"],
  nextPossibleDrawPossible: ["File", "Planning", "Possible Draw"],
  nextPossibleDrawScoreGrid: ["File", "Planning", "Predictive Score Grid"],
  nextPossibleDrawReal: ["File", "Planning", "Real Draw"],
  lastSeenHighlight: ["Statistics", "Views", "Last Seen Highlight"],
  lastSeenGapHighlight: ["Statistics", "Views", "Last Seen Gap Highlight"],
  lastSeenDifferenceHighlight: ["Statistics", "Views", "Last Seen Difference Highlight"],
  entropy: ["Statistics", "Views", "Entropy Report"],
  freshness: ["Statistics", "Views", "Freshness Report"],
  proximity: ["Statistics", "Views", "Proximity Report"],
  chiSquare: ["Statistics", "Views", "Chi-square Report"],
  autocorrelation: ["Statistics", "Views", "Autocorrelation Report"],
  coOccurrence: ["Statistics", "Views", "Co-occurrence Network"],
  markovScore: ["Statistics", "Views", "100 Markov Score"],
  bayesianMarkov: ["Statistics", "Views", "Bayesian Markov Score"],
  mixedPrediction: ["Statistics", "Views", "Mixed Prediction"],
  scoreGraphs: ["Statistics", "Graphs", "Score Timeline"],
};
const appBreadcrumbs = computed(() =>
  activeWorkspaceView.value === null ? [] : workspaceBreadcrumbs[activeWorkspaceView.value],
);
const isAppLoading = computed(() => isLoading.value || !authChecked.value);

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
const chiSquareModel = computed(() => buildChiSquareModel(statisticsReferenceHistory.value));
const autocorrelationModel = computed(() =>
  buildAutocorrelationModel(statisticsReferenceHistory.value),
);
const coOccurrenceModel = computed(() => buildCoOccurrenceModel(statisticsReferenceHistory.value));
const markovScoreModel = computed(() => buildMarkovScoreModel(statisticsReferenceHistory.value));

function openLastSeenHighlight(): void {
  activeHighlightView.value = "number";
  openWorkspaceView("lastSeenHighlight");
}

function openLastSeenGapHighlight(): void {
  activeHighlightView.value = "gap";
  openWorkspaceView("lastSeenGapHighlight");
}

function openLastSeenDifferenceHighlight(): void {
  activeHighlightView.value = "difference";
  openWorkspaceView("lastSeenDifferenceHighlight");
}

function openDraws(): void {
  if (!openWorkspaceViews.value.includes("drawScores")) {
    openWorkspaceViews.value = [...openWorkspaceViews.value, "drawScores"];
  }

  openWorkspaceView("draws");
}

function openAllDraws(): void {
  openWorkspaceView("allDraws");
}

function openNextPossibleDrawPossible(): void {
  openWorkspaceView("nextPossibleDrawPossible");
}

function openNextPossibleDrawScoreGrid(): void {
  openWorkspaceView("nextPossibleDrawScoreGrid");
}

function openNextPossibleDrawReal(): void {
  openWorkspaceView("nextPossibleDrawReal");
}

function openFreshnessReport(): void {
  openWorkspaceView("freshness");
}

function openEntropyReport(): void {
  openWorkspaceView("entropy");
}

function openProximityReport(): void {
  openWorkspaceView("proximity");
}

function openChiSquareReport(): void {
  openWorkspaceView("chiSquare");
}

function openAutocorrelationReport(): void {
  openWorkspaceView("autocorrelation");
}

function openCoOccurrenceReport(): void {
  openWorkspaceView("coOccurrence");
}

function openMarkovScoreReport(): void {
  openWorkspaceView("markovScore");
}

function openBayesianMarkovReport(): void {
  openWorkspaceView("bayesianMarkov");
}

function openMixedPredictionReport(): void {
  openWorkspaceView("mixedPrediction");
}

function openScoreGraphs(): void {
  openWorkspaceView("scoreGraphs");
}

function openSettings(): void {
  if (!authUser.value) {
    return;
  }

  isSettingsOpen.value = true;
}

function closeSettings(): void {
  isSettingsOpen.value = false;
}

async function loadSettings(): Promise<void> {
  try {
    const storedSettings = await window.pylottoDesktop?.loadSettings();

    if (storedSettings) {
      appSettings.value = storedSettings;
    }
  } catch {
    appSettings.value = { implementLawOfLargeNumbers: false };
  }
}

async function saveSettings(settings: AppSettings): Promise<void> {
  const savedSettings = await window.pylottoDesktop?.saveSettings(settings);
  appSettings.value = savedSettings ?? settings;
  closeSettings();
}

function syncWorkspaceFlags(): void {
  if (activeWorkspaceView.value === "lastSeenHighlight") {
    activeHighlightView.value = "number";
  }

  if (activeWorkspaceView.value === "lastSeenGapHighlight") {
    activeHighlightView.value = "gap";
  }

  if (activeWorkspaceView.value === "lastSeenDifferenceHighlight") {
    activeHighlightView.value = "difference";
  }

  isDrawsOpen.value = activeWorkspaceView.value === "draws";
  isDrawScoresOpen.value = activeWorkspaceView.value === "drawScores";
  isAllDrawsOpen.value = activeWorkspaceView.value === "allDraws";
  isNextPossibleDrawOpen.value =
    activeWorkspaceView.value === "nextPossibleDrawPossible" ||
    activeWorkspaceView.value === "nextPossibleDrawScoreGrid" ||
    activeWorkspaceView.value === "nextPossibleDrawReal";
  isHighlightViewsOpen.value =
    activeWorkspaceView.value === "lastSeenHighlight" ||
    activeWorkspaceView.value === "lastSeenGapHighlight" ||
    activeWorkspaceView.value === "lastSeenDifferenceHighlight";
  isEntropyReportOpen.value = activeWorkspaceView.value === "entropy";
  isFreshnessReportOpen.value = activeWorkspaceView.value === "freshness";
  isProximityReportOpen.value = activeWorkspaceView.value === "proximity";
  isChiSquareReportOpen.value = activeWorkspaceView.value === "chiSquare";
  isAutocorrelationReportOpen.value = activeWorkspaceView.value === "autocorrelation";
  isCoOccurrenceReportOpen.value = activeWorkspaceView.value === "coOccurrence";
  isMarkovScoreReportOpen.value = activeWorkspaceView.value === "markovScore";
  isBayesianMarkovReportOpen.value = activeWorkspaceView.value === "bayesianMarkov";
  isMixedPredictionReportOpen.value = activeWorkspaceView.value === "mixedPrediction";
  isScoreGraphsOpen.value = activeWorkspaceView.value === "scoreGraphs";
}

function openWorkspaceView(view: WorkspaceView): void {
  if (!authUser.value) {
    return;
  }

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

  closeWorkspaceView(activeView);
}

function closeWorkspaceView(view: WorkspaceView): void {
  const closingIndex = openWorkspaceViews.value.indexOf(view);

  if (closingIndex === -1) {
    return;
  }

  const remainingViews = openWorkspaceViews.value.filter((openView) => openView !== view);
  openWorkspaceViews.value = remainingViews;

  if (activeWorkspaceView.value === view) {
    activeWorkspaceView.value =
      remainingViews[Math.min(closingIndex, remainingViews.length - 1)] ?? null;
  }

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

async function submitAuth(): Promise<void> {
  if (isAuthenticating.value) {
    return;
  }

  isAuthenticating.value = true;
  authError.value = "";

  try {
    const credentials = {
      email: authEmail.value,
      password: authPassword.value,
    };
    const user =
      authMode.value === "register"
        ? await window.pylottoDesktop?.authRegister(credentials)
        : await window.pylottoDesktop?.authLogin(credentials);

    if (!user) {
      throw new Error("Desktop authentication is unavailable.");
    }

    authUser.value = user;
    authEmail.value = user.email;
    authPassword.value = "";
    await loadSettings();
  } catch (error) {
    authError.value = error instanceof Error ? error.message : "Could not sign in.";
  } finally {
    isAuthenticating.value = false;
  }
}

async function logout(): Promise<void> {
  await window.pylottoDesktop?.authLogout();
  authUser.value = null;
  authPassword.value = "";
  appSettings.value = { implementLawOfLargeNumbers: false };
  closeSettings();
  openWorkspaceViews.value = [];
  activeWorkspaceView.value = null;
  syncWorkspaceFlags();
}

let unsubscribeMenuAction: (() => void) | null = null;

onMounted(() => {
  if (window.pylottoDesktop) {
    window.pylottoDesktop
      .authCurrentUser()
      .then((user) => {
        authUser.value = user;
        authEmail.value = user?.email ?? "";
        if (user) {
          void loadSettings();
        }
      })
      .catch(() => {
        authUser.value = null;
      })
      .finally(() => {
        authChecked.value = true;
      });
  } else {
    authChecked.value = true;
  }

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

      if (message.action === "openAllDraws") {
        openAllDraws();
      }

      if (message.action === "openNextPossibleDraw") {
        openNextPossibleDrawPossible();
      }

      if (message.action === "openNextPossibleDrawPossible") {
        openNextPossibleDrawPossible();
      }

      if (message.action === "openNextPossibleDrawScoreGrid") {
        openNextPossibleDrawScoreGrid();
      }

      if (message.action === "openNextPossibleDrawReal") {
        openNextPossibleDrawReal();
      }

      if (message.action === "openFreshnessReport") {
        openFreshnessReport();
      }

      if (message.action === "openEntropyReport") {
        openEntropyReport();
      }

      if (message.action === "openProximityReport") {
        openProximityReport();
      }

      if (message.action === "openChiSquareReport") {
        openChiSquareReport();
      }

      if (message.action === "openAutocorrelationReport") {
        openAutocorrelationReport();
      }

      if (message.action === "openCoOccurrenceReport") {
        openCoOccurrenceReport();
      }

      if (message.action === "openMarkovScoreReport") {
        openMarkovScoreReport();
      }

      if (message.action === "openBayesianMarkovReport") {
        openBayesianMarkovReport();
      }

      if (message.action === "openMixedPredictionReport") {
        openMixedPredictionReport();
      }

      if (message.action === "openScoreGraphs") {
        openScoreGraphs();
      }

      if (message.action === "openSettings") {
        openSettings();
      }
    }) ?? null;
});

onBeforeUnmount(() => {
  unsubscribeMenuAction?.();
});
</script>

<template>
  <main class="app-shell">
    <header v-if="authUser" class="app-toolbar" aria-label="Application toolbar">
      <button
        class="app-toolbar-button"
        :disabled="isAppLoading || !authUser || !!loadError || totalDraws === 0"
        type="button"
        aria-label="Open Draws"
        title="Open Draws"
        @click="openDraws"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-13Zm2.5-.75a.75.75 0 0 0-.75.75v13c0 .41.34.75.75.75h11c.41 0 .75-.34.75-.75v-13a.75.75 0 0 0-.75-.75h-11ZM8 8h8v1.5H8V8Zm0 3.25h8v1.5H8v-1.5Zm0 3.25h5.5V16H8v-1.5Z"
          />
        </svg>
      </button>
      <button
        class="app-toolbar-button"
        :disabled="isAppLoading || !authUser || !!loadError || totalDraws === 0"
        type="button"
        aria-label="Open Possible Draw"
        title="Open Possible Draw"
        @click="openNextPossibleDrawPossible"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path
            d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm0 1.75a7.75 7.75 0 1 1 0 15.5 7.75 7.75 0 0 1 0-15.5Zm-.88 3.5h1.76v3.37h3.37v1.76h-3.37v3.37h-1.76v-3.37H7.75v-1.76h3.37V7.75Z"
          />
        </svg>
      </button>
      <button
        class="app-toolbar-button"
        :disabled="isAppLoading || !authUser || !!loadError || totalDraws === 0"
        type="button"
        aria-label="Open Predictive Score Grid"
        title="Open Predictive Score Grid"
        @click="openNextPossibleDrawScoreGrid"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path
            d="M4 4h16v16H4V4Zm1.75 1.75v3h3v-3h-3Zm4.75 0v3h3v-3h-3Zm4.75 0v3h3v-3h-3Zm-9.5 4.75v3h3v-3h-3Zm4.75 0v3h3v-3h-3Zm4.75 0v3h3v-3h-3Zm-9.5 4.75v3h3v-3h-3Zm4.75 0v3h3v-3h-3Zm4.75 0v3h3v-3h-3Z"
          />
        </svg>
      </button>
      <button
        class="app-toolbar-button"
        :disabled="isAppLoading || !authUser || !!loadError || totalDraws === 0"
        type="button"
        aria-label="Open Real Draw"
        title="Open Real Draw"
        @click="openNextPossibleDrawReal"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path
            d="M7 2.75h1.75V5h6.5V2.75H17V5h2.5A1.5 1.5 0 0 1 21 6.5v12A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-12A1.5 1.5 0 0 1 4.5 5H7V2.75ZM4.75 9v9.25h14.5V9H4.75Zm2.5 2.25h2v2h-2v-2Zm3.75 0h2v2h-2v-2Zm3.75 0h2v2h-2v-2Zm-7.5 3.75h2v2h-2v-2Zm3.75 0h2v2h-2v-2Z"
          />
        </svg>
      </button>
      <button
        class="app-toolbar-button"
        :disabled="isAppLoading || !authUser"
        type="button"
        aria-label="Open Settings"
        title="Open Settings"
        @click="openSettings"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path
            d="M12 8.25A3.75 3.75 0 1 1 12 15.75 3.75 3.75 0 0 1 12 8.25Zm0 1.75a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7.28 1.1.03.9-.03.9 1.73 1.36-1.74 3-2.05-.82a7.72 7.72 0 0 1-1.56.9l-.31 2.16h-3.48l-.31-2.16a7.72 7.72 0 0 1-1.56-.9l-2.05.82-1.74-3 1.73-1.36-.03-.9.03-.9-1.73-1.36 1.74-3 2.05.82c.48-.36 1-.66 1.56-.9l.31-2.16h3.48l.31 2.16c.56.24 1.08.54 1.56.9l2.05-.82 1.74 3-1.73 1.36Zm-1.73 2.46c.06-.51.06-1.11 0-1.62l-.09-.68 1.28-1-.54-.94-1.52.61-.55-.42a5.7 5.7 0 0 0-1.41-.81l-.64-.26-.23-1.59h-1.08l-.23 1.59-.64.26a5.7 5.7 0 0 0-1.41.81l-.55.42-1.52-.61-.54.94 1.28 1-.09.68a6.5 6.5 0 0 0 0 1.62l.09.68-1.28 1 .54.94 1.52-.61.55.42c.43.34.9.61 1.41.81l.64.26.23 1.59h1.08l.23-1.59.64-.26c.51-.2.98-.47 1.41-.81l.55-.42 1.52.61.54-.94-1.28-1 .09-.68Z"
          />
        </svg>
      </button>
      <nav
        v-if="appBreadcrumbs.length > 0"
        class="app-breadcrumbs"
        aria-label="Application breadcrumbs"
      >
        <span
          v-for="(breadcrumb, index) in appBreadcrumbs"
          :key="`${breadcrumb}-${index}`"
          class="app-breadcrumb"
        >
          {{ breadcrumb }}
        </span>
      </nav>
      <div v-if="authUser" class="user-session-pill">
        <span>{{ authUser.email }}</span>
        <button type="button" @click="logout">Sign out</button>
      </div>
    </header>

    <section v-if="!authUser" class="auth-panel">
      <form class="auth-card" @submit.prevent="submitAuth">
        <p class="eyebrow">User Account</p>
        <h1>{{ authMode === "register" ? "Register PyLotto" : "Sign In" }}</h1>
        <label>
          Email
          <input v-model="authEmail" autocomplete="email" type="email" required>
        </label>
        <label>
          Password
          <input
            v-model="authPassword"
            autocomplete="current-password"
            minlength="6"
            type="password"
            required
          >
        </label>
        <p v-if="authError" class="auth-error">{{ authError }}</p>
        <button class="action-button primary" :disabled="isAuthenticating" type="submit">
          {{ isAuthenticating ? "Working..." : authMode === "register" ? "Register" : "Sign In" }}
        </button>
        <button
          class="ghost-button compact-button"
          type="button"
          @click="authMode = authMode === 'register' ? 'login' : 'register'; authError = ''"
        >
          {{ authMode === "register" ? "Use existing account" : "Create account" }}
        </button>
      </form>
    </section>

    <section v-else class="hero-panel">
      <p class="eyebrow">Electron + Vue Port</p>
      <h1>PyLotto Statistics Workspace</h1>
      <p v-if="isAppLoading" class="hero-copy">
        Loading lotto draws from the YAML file bundled with the Electron app.
      </p>
      <p v-else-if="loadError" class="hero-copy">
        {{ loadError }}
      </p>
      <p v-else class="hero-copy">
        The desktop shell now runs on Electron with Vue. Use the toolbar or menus to browse draws,
        plan possible numbers, inspect the predictive score grid, save a real draw, or open
        statistics reports including
        <strong>Statistics / Views / Last Seen Highlight</strong>
        or
        <strong>Statistics / Views / Last Seen Gap Highlight</strong>
        or
        <strong>Statistics / Views / Last Seen Difference Highlight</strong>
        or
        <strong>Statistics / Views / Entropy Report</strong>
        or
        <strong>Statistics / Views / Freshness Report</strong>
        or
        <strong>Statistics / Views / Proximity Report</strong>
        or
        <strong>Statistics / Views / Chi-square Report</strong>
        or
        <strong>Statistics / Views / Autocorrelation Report</strong>
        or
        <strong>Statistics / Views / Co-occurrence Network</strong>
        or
        <strong>Statistics / Views / 100 Markov Score</strong>
        or
        <strong>Statistics / Views / Bayesian Markov Score</strong>
        or
        <strong>Statistics / Views / Mixed Prediction</strong>
        or
        <strong>Statistics / Graphs / Score Timeline</strong>
        to open runtime YAML-driven statistics dialogs.
      </p>

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

    <SettingsDialog
      v-if="isSettingsOpen"
      :settings="appSettings"
      @close="closeSettings"
      @save="saveSettings"
    />

    <DrawsDialog
      v-if="isDrawsOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'draws'"
      :draws="history.draws"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @switch-workspace-view="switchWorkspaceView"
    />

    <DrawScoresDialog
      v-if="isDrawScoresOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'drawScores'"
      :draws="history.draws"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @switch-workspace-view="switchWorkspaceView"
    />

    <AllDrawsDialog
      v-if="isAllDrawsOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'allDraws'"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @switch-workspace-view="switchWorkspaceView"
    />

    <NextPossibleDrawDialog
      v-if="isNextPossibleDrawOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'nextPossibleDrawPossible'"
      :current-user-email="authUser?.email ?? ''"
      :freshness-model="freshnessModel"
      :history="statisticsReferenceHistory"
      :proximity-model="proximityModel"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @switch-workspace-view="switchWorkspaceView"
    />

    <LastSeenHighlightDialog
      v-if="isHighlightViewsOpen && activeHighlightView === 'number' && !isLoading && !loadError"
      :active-view="activeHighlightView"
      :active-workspace-view="activeWorkspaceView ?? 'lastSeenHighlight'"
      :draw-count="totalDraws"
      :draw-count-value="drawCount"
      :last-50-model="lastSeenLast50Model"
      :model="model"
      :reference-draw-offset="referenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-draw="showFirstDraw"
      @latest-draw="showLatestDraw"
      @next-draw="showNextDraw"
      @previous-draw="showPreviousDraw"
      @switch-view="openLastSeenHighlight"
      @switch-workspace-view="switchWorkspaceView"
      @update-draw-count="updateDrawCount"
    />

    <LastSeenGapHighlightDialog
      v-if="isHighlightViewsOpen && activeHighlightView === 'gap' && !isLoading && !loadError"
      :active-view="activeHighlightView"
      :active-workspace-view="activeWorkspaceView ?? 'lastSeenGapHighlight'"
      :draw-count="totalDraws"
      :draw-count-value="gapDrawCount"
      :last-50-model="lastSeenGapLast50Model"
      :model="gapModel"
      :reference-draw-offset="gapReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-draw="showFirstGapDraw"
      @latest-draw="showLatestGapDraw"
      @next-draw="showNextGapDraw"
      @previous-draw="showPreviousGapDraw"
      @switch-view="openLastSeenGapHighlight"
      @switch-workspace-view="switchWorkspaceView"
      @update-draw-count="updateGapDrawCount"
    />

    <LastSeenDifferenceHighlightDialog
      v-if="isHighlightViewsOpen && activeHighlightView === 'difference' && !isLoading && !loadError"
      :active-view="activeHighlightView"
      :active-workspace-view="activeWorkspaceView ?? 'lastSeenDifferenceHighlight'"
      :draw-count="totalDraws"
      :draw-count-value="differenceDrawCount"
      :last-50-model="lastSeenDifferenceLast50Model"
      :model="differenceModel"
      :reference-draw-offset="differenceReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-draw="showFirstDifferenceDraw"
      @latest-draw="showLatestDifferenceDraw"
      @next-draw="showNextDifferenceDraw"
      @previous-draw="showPreviousDifferenceDraw"
      @switch-view="openLastSeenDifferenceHighlight"
      @switch-workspace-view="switchWorkspaceView"
      @update-draw-count="updateDifferenceDrawCount"
    />

    <FreshnessReportDialog
      v-if="isFreshnessReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'freshness'"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :model="freshnessModel"
      :next-actual-draw="statisticsNextActualDraw"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />

    <EntropyReportDialog
      v-if="isEntropyReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'entropy'"
      :history="statisticsReferenceHistory"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :next-actual-draw="statisticsNextActualDraw"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
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
      :next-actual-draw="statisticsNextActualDraw"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />

    <ChiSquareReportDialog
      v-if="isChiSquareReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'chiSquare'"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :model="chiSquareModel"
      :next-actual-draw="statisticsNextActualDraw"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />

    <AutocorrelationReportDialog
      v-if="isAutocorrelationReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'autocorrelation'"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :model="autocorrelationModel"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />

    <CoOccurrenceReportDialog
      v-if="isCoOccurrenceReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'coOccurrence'"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :model="coOccurrenceModel"
      :next-actual-draw="statisticsNextActualDraw"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
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
      :next-actual-draw="statisticsNextActualDraw"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />

    <BayesianMarkovReportDialog
      v-if="isBayesianMarkovReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'bayesianMarkov'"
      :history="statisticsReferenceHistory"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :next-actual-draw="statisticsNextActualDraw"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />

    <MixedPredictionReportDialog
      v-if="isMixedPredictionReportOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'mixedPrediction'"
      :freshness-model="freshnessModel"
      :history="statisticsReferenceHistory"
      :max-reference-draw-offset="maxStatisticsReferenceDrawOffset"
      :next-actual-draw="statisticsNextActualDraw"
      :proximity-model="proximityModel"
      :reference-draw-offset="statisticsReferenceDrawOffset"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @first-reference-draw="showFirstStatisticsReferenceDraw"
      @latest-reference-draw="showLatestStatisticsReferenceDraw"
      @next-reference-draw="showNextStatisticsReferenceDraw"
      @previous-reference-draw="showPreviousStatisticsReferenceDraw"
      @switch-workspace-view="switchWorkspaceView"
    />

    <ScoreGraphsDialog
      v-if="isScoreGraphsOpen && !isLoading && !loadError"
      :active-workspace-view="activeWorkspaceView ?? 'scoreGraphs'"
      :history="history"
      :workspace-tabs="workspaceTabs"
      @close="closeActiveWorkspaceView"
      @close-workspace-view="closeWorkspaceView"
      @switch-workspace-view="switchWorkspaceView"
    />
  </main>
</template>

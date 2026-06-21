<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import predictiveScoreGridJson from "../data/predictive-score-grid.json";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type { PredictiveScoreGrid, PredictiveScoreNumber, WorkspaceTab, WorkspaceView } from "../types";

const nextDrawStorageKey = "pylotto.nextPossibleDrawNumbers";
const droppedDrawStorageKey = "pylotto.nextPossibleDrawDroppedNumbers";
const uncertainDrawStorageKey = "pylotto.nextPossibleDrawUncertainNumbers";
const realDrawDateStorageKey = "pylotto.realDrawDate";
const realDrawNumbersByDateStorageKey = "pylotto.realDrawNumbersByDate";
type NextDrawTab = "possible" | "scoreGrid" | "real";
interface NextPossibleDrawState {
  selectedNumbers: number[];
  droppedNumbers: number[];
  uncertainNumbers: number[];
}

type RealDrawNumbersByDate = Record<string, number[]>;

function todayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const emit = defineEmits<{
  close: [];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  workspaceTabs: WorkspaceTab[];
}>();

function normalizeNumbers(values: unknown, maximumCount = Infinity): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 49),
    ),
  ]
    .sort((left, right) => left - right)
    .slice(0, maximumCount);
}

function loadStoredNumbers(storageKey: string, maximumCount = Infinity): number[] {
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    const parsedValue: unknown = storedValue === null ? [] : JSON.parse(storedValue);

    return normalizeNumbers(parsedValue, maximumCount);
  } catch {
    return [];
  }
}

function loadStoredDate(storageKey: string, fallbackDate: string): string {
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    const date = String(storedValue ?? "").trim();

    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallbackDate;
  } catch {
    return fallbackDate;
  }
}

function loadStoredRealDrawNumbersByDate(): RealDrawNumbersByDate {
  try {
    const storedValue = window.localStorage.getItem(realDrawNumbersByDateStorageKey);
    const parsedValue: unknown = storedValue === null ? {} : JSON.parse(storedValue);

    if (typeof parsedValue !== "object" || parsedValue === null || Array.isArray(parsedValue)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedValue)
        .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .map(([date, numbers]) => [date, normalizeNumbers(numbers, 6)]),
    );
  } catch {
    return {};
  }
}

function saveStoredRealDrawNumbersByDate(numbersByDate: RealDrawNumbersByDate): void {
  try {
    window.localStorage.setItem(realDrawNumbersByDateStorageKey, JSON.stringify(numbersByDate));
  } catch {
    // The in-memory state remains usable if local storage is unavailable.
  }
}

function loadStoredRealDrawNumbers(date: string): number[] {
  return loadStoredRealDrawNumbersByDate()[date] ?? [];
}

function saveStoredRealDrawState(date: string, numbers: number[]): void {
  try {
    window.localStorage.setItem(realDrawDateStorageKey, date);
  } catch {
    // Ignore storage failures; the current tab state still works.
  }

  const numbersByDate = loadStoredRealDrawNumbersByDate();
  numbersByDate[date] = normalizeNumbers(numbers, 6);
  saveStoredRealDrawNumbersByDate(numbersByDate);
}

function loadLocalNextPossibleDrawState(): NextPossibleDrawState {
  return {
    selectedNumbers: loadStoredNumbers(nextDrawStorageKey, 6),
    droppedNumbers: loadStoredNumbers(droppedDrawStorageKey),
    uncertainNumbers: loadStoredNumbers(uncertainDrawStorageKey),
  };
}

function stateHasNumbers(state: NextPossibleDrawState): boolean {
  return (
    state.selectedNumbers.length > 0 ||
    state.droppedNumbers.length > 0 ||
    state.uncertainNumbers.length > 0
  );
}

function saveStoredNumbers(storageKey: string, numbers: number[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(numbers));
  } catch {
    // Ignore storage failures; the in-memory state still works for this session.
  }
}

function buildCurrentState(): NextPossibleDrawState {
  return {
    selectedNumbers: normalizeNumbers([...nextDrawNumbers.value], 6),
    droppedNumbers: normalizeNumbers([...droppedDrawNumbers.value]),
    uncertainNumbers: normalizeNumbers([...uncertainDrawNumbers.value]),
  };
}

function saveNextPossibleDrawState(): void {
  const state = buildCurrentState();

  saveStoredNumbers(nextDrawStorageKey, state.selectedNumbers);
  saveStoredNumbers(droppedDrawStorageKey, state.droppedNumbers);
  saveStoredNumbers(uncertainDrawStorageKey, state.uncertainNumbers);
  void window.pylottoDesktop?.saveNextPossibleDrawState(state).catch(() => {
    // The local storage fallback keeps planning usable if desktop persistence fails.
  });
}

function applyNextPossibleDrawState(state: NextPossibleDrawState): void {
  const selectedNumbers = normalizeNumbers(state.selectedNumbers, 6);
  const selectedSet = new Set(selectedNumbers);

  nextDrawNumbers.value = selectedSet;
  droppedDrawNumbers.value = new Set(normalizeNumbers(state.droppedNumbers));
  uncertainDrawNumbers.value = new Set(
    normalizeNumbers(state.uncertainNumbers).filter((number) => !selectedSet.has(number)),
  );
}

const localState = loadLocalNextPossibleDrawState();
const nextDrawNumbers = ref<Set<number>>(new Set(localState.selectedNumbers));
const droppedDrawNumbers = ref<Set<number>>(new Set(localState.droppedNumbers));
const uncertainDrawNumbers = ref<Set<number>>(new Set(localState.uncertainNumbers));
const activeTab = computed<NextDrawTab>(() => {
  if (props.activeWorkspaceView === "nextPossibleDrawScoreGrid") {
    return "scoreGrid";
  }

  if (props.activeWorkspaceView === "nextPossibleDrawReal") {
    return "real";
  }

  return "possible";
});
const realDrawDate = ref(loadStoredDate(realDrawDateStorageKey, todayIsoDate()));
const realDrawNumbers = ref<Set<number>>(new Set(loadStoredRealDrawNumbers(realDrawDate.value)));
const realDrawSaveError = ref("");
const realDrawSaveMessage = ref("");
const isSavingRealDraw = ref(false);
const selectedPredictiveRank = ref(1);
const nextDrawCount = computed(() => nextDrawNumbers.value.size);
const droppedDrawCount = computed(() => droppedDrawNumbers.value.size);
const uncertainDrawCount = computed(() => uncertainDrawNumbers.value.size);
const planningNumberCount = computed(
  () => nextDrawCount.value + droppedDrawCount.value + uncertainDrawCount.value,
);
const predictiveScoreGrid = predictiveScoreGridJson as PredictiveScoreGrid;
const scoreRowsByNumber = computed(() => {
  const rows = new Map<number, PredictiveScoreNumber>();

  for (const row of predictiveScoreGrid.numbers) {
    rows.set(row.number, row);
  }

  return rows;
});
const scoreRange = computed(() => {
  const scores = predictiveScoreGrid.numbers.map((row) => row.score);

  return {
    min: Math.min(...scores),
    max: Math.max(...scores),
  };
});
const maxScoreRank = computed(() => predictiveScoreGrid.numbers.length);
const selectedPredictiveNumber = computed(() => {
  const row = predictiveScoreGrid.numbers.find(
    (candidate) => candidate.rank === selectedPredictiveRank.value,
  );

  return row?.number ?? null;
});
const selectedDrawNumbers = computed(() =>
  [...nextDrawNumbers.value].sort((left, right) => left - right),
);
const selectedRealDrawNumbers = computed(() =>
  [...realDrawNumbers.value].sort((left, right) => left - right),
);
const realDrawMatchNumbers = computed(() => {
  const realNumbers = new Set(selectedRealDrawNumbers.value);

  return selectedDrawNumbers.value.filter((number) => realNumbers.has(number));
});
const realDrawMatchCount = computed(() => realDrawMatchNumbers.value.length);
const canSaveRealDraw = computed(
  () =>
    selectedRealDrawNumbers.value.length === 6 &&
    /^\d{4}-\d{2}-\d{2}$/.test(realDrawDate.value) &&
    !isSavingRealDraw.value,
);
const selectedPredictiveRows = computed(() =>
  selectedDrawNumbers.value
    .map((number) => scoreRowsByNumber.value.get(number))
    .filter((row): row is PredictiveScoreNumber => row !== undefined),
);
const topPickMatchCount = computed(() => {
  const topNumbers = new Set(predictiveScoreGrid.topNumbers);

  return selectedDrawNumbers.value.filter((number) => topNumbers.has(number)).length;
});
const averageSelectedRank = computed(() => {
  if (selectedPredictiveRows.value.length === 0) {
    return null;
  }

  const rankTotal = selectedPredictiveRows.value.reduce(
    (total, row) => total + row.rank,
    0,
  );

  return rankTotal / selectedPredictiveRows.value.length;
});
const averageSelectedStrength = computed(() => {
  if (selectedPredictiveRows.value.length === 0 || maxScoreRank.value <= 1) {
    return 0;
  }

  const strengthTotal = selectedPredictiveRows.value.reduce(
    (total, row) => total + (maxScoreRank.value - row.rank) / (maxScoreRank.value - 1),
    0,
  );

  return strengthTotal / selectedPredictiveRows.value.length;
});
const predictionAgreementScore = computed(() => {
  if (nextDrawCount.value === 0) {
    return 0;
  }

  const completeness = nextDrawCount.value / 6;
  const topPickOverlap = topPickMatchCount.value / 6;
  const score = (
    0.55 * averageSelectedStrength.value
    + 0.35 * topPickOverlap
    + 0.1 * completeness
  ) * 100;

  return Math.round(score);
});
const predictionAgreementLabel = computed(() => {
  if (nextDrawCount.value === 0) {
    return "Select numbers";
  }

  if (predictionAgreementScore.value >= 80) {
    return "Very strong";
  }

  if (predictionAgreementScore.value >= 60) {
    return "Strong";
  }

  if (predictionAgreementScore.value >= 40) {
    return "Moderate";
  }

  return "Low";
});
let clickTimer: ReturnType<typeof setTimeout> | null = null;

watch([nextDrawNumbers, droppedDrawNumbers, uncertainDrawNumbers], () => {
  saveNextPossibleDrawState();
});

watch(realDrawDate, (date) => {
  try {
    window.localStorage.setItem(realDrawDateStorageKey, date);
  } catch {
    // Ignore storage failures; the current tab state still works.
  }

  void loadRealDrawForDate(date);
});

watch(realDrawNumbers, () => {
  saveStoredRealDrawState(realDrawDate.value, selectedRealDrawNumbers.value);
});

function clearClickTimer(): void {
  if (clickTimer !== null) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
}

function toggleNextDrawNumber(number: number): void {
  if (droppedDrawNumbers.value.has(number)) {
    return;
  }

  const nextNumbers = new Set(nextDrawNumbers.value);
  const nextUncertainNumbers = new Set(uncertainDrawNumbers.value);

  if (nextNumbers.has(number)) {
    nextNumbers.delete(number);
  } else if (nextNumbers.size < 6) {
    nextNumbers.add(number);
    nextUncertainNumbers.delete(number);
  } else {
    return;
  }

  nextDrawNumbers.value = nextNumbers;
  uncertainDrawNumbers.value = nextUncertainNumbers;
}

function queueNextDrawToggle(number: number): void {
  clearClickTimer();
  clickTimer = setTimeout(() => {
    toggleNextDrawNumber(number);
    clickTimer = null;
  }, 220);
}

function toggleUncertainDrawNumber(number: number): void {
  clearClickTimer();

  if (droppedDrawNumbers.value.has(number)) {
    return;
  }

  const nextUncertainNumbers = new Set(uncertainDrawNumbers.value);

  if (nextUncertainNumbers.has(number)) {
    nextUncertainNumbers.delete(number);
  } else {
    nextUncertainNumbers.add(number);
  }

  uncertainDrawNumbers.value = nextUncertainNumbers;
}

function toggleDroppedDrawNumber(number: number): void {
  clearClickTimer();

  const nextDroppedNumbers = new Set(droppedDrawNumbers.value);
  const nextNumbers = new Set(nextDrawNumbers.value);
  const nextUncertainNumbers = new Set(uncertainDrawNumbers.value);

  if (nextDroppedNumbers.has(number)) {
    nextDroppedNumbers.delete(number);
  } else {
    nextDroppedNumbers.add(number);
    nextNumbers.delete(number);
    nextUncertainNumbers.delete(number);
  }

  droppedDrawNumbers.value = nextDroppedNumbers;
  nextDrawNumbers.value = nextNumbers;
  uncertainDrawNumbers.value = nextUncertainNumbers;
}

function handlePossibleNumberDoubleClick(event: MouseEvent, number: number): void {
  if (event.ctrlKey) {
    toggleUncertainDrawNumber(number);
    return;
  }

  toggleDroppedDrawNumber(number);
}

function handleScoreNumberDoubleClick(number: number): void {
  toggleUncertainDrawNumber(number);
}

function selectPredictiveRank(value: number): void {
  if (!Number.isFinite(value)) {
    return;
  }

  selectedPredictiveRank.value = Math.min(
    Math.max(Math.trunc(value), 1),
    maxScoreRank.value,
  );
}

function showPreviousPredictiveRank(): void {
  selectPredictiveRank(selectedPredictiveRank.value - 1);
}

function showNextPredictiveRank(): void {
  selectPredictiveRank(selectedPredictiveRank.value + 1);
}

function showFirstPredictiveRank(): void {
  selectPredictiveRank(1);
}

function showLastPredictiveRank(): void {
  selectPredictiveRank(maxScoreRank.value);
}

function selectPredictiveNumberRank(number: number): void {
  const row = scoreRowsByNumber.value.get(number);

  if (row) {
    selectPredictiveRank(row.rank);
  }
}

function resetNextDrawNumbers(): void {
  clearClickTimer();
  nextDrawNumbers.value = new Set();
  droppedDrawNumbers.value = new Set();
  uncertainDrawNumbers.value = new Set();
}

function toggleRealDrawNumber(number: number): void {
  const nextNumbers = new Set(realDrawNumbers.value);

  if (nextNumbers.has(number)) {
    nextNumbers.delete(number);
  } else if (nextNumbers.size < 6) {
    nextNumbers.add(number);
  } else {
    return;
  }

  realDrawNumbers.value = nextNumbers;
  realDrawSaveError.value = "";
  realDrawSaveMessage.value = "";
}

function resetRealDrawNumbers(): void {
  realDrawNumbers.value = new Set();
  realDrawSaveError.value = "";
  realDrawSaveMessage.value = "";
}

async function saveRealDraw(): Promise<void> {
  if (!canSaveRealDraw.value) {
    return;
  }

  isSavingRealDraw.value = true;
  realDrawSaveError.value = "";
  realDrawSaveMessage.value = "";

  try {
    const result = await window.pylottoDesktop?.saveRealDraw({
      date: realDrawDate.value,
      numbers: selectedRealDrawNumbers.value,
      plannedNumbers: selectedDrawNumbers.value,
    });

    if (!result) {
      throw new Error("Desktop API is unavailable.");
    }

    realDrawSaveMessage.value =
      `Saved ${result.date}. Guessed ${result.matchCount} of 6. YAML: ${result.yamlPath}`;
  } catch (error) {
    realDrawSaveError.value =
      error instanceof Error ? error.message : "Could not save the real draw.";
  } finally {
    isSavingRealDraw.value = false;
  }
}

async function loadRealDrawForDate(date: string): Promise<void> {
  try {
    const history = await window.pylottoDesktop?.loadLottoHistory();
    const currentDraw = history?.draws.find((draw) => draw.date === date);

    realDrawNumbers.value = new Set(
      currentDraw ? normalizeNumbers(currentDraw.numbers, 6) : loadStoredRealDrawNumbers(date),
    );
    realDrawSaveError.value = "";
    realDrawSaveMessage.value = "";
  } catch {
    // The real draw tab remains usable for new entries if history loading fails.
  }
}

function colorChannel(start: number, end: number, ratio: number): number {
  return Math.round(start + (end - start) * ratio);
}

function scorePercent(number: number): number {
  const row = scoreRowsByNumber.value.get(number);

  if (!row) {
    return 0;
  }

  const spread = scoreRange.value.max - scoreRange.value.min;
  if (spread <= 0) {
    return 0;
  }

  return Math.min(Math.max((row.score - scoreRange.value.min) / spread, 0), 1);
}

function gradientRatio(number: number): number {
  const row = scoreRowsByNumber.value.get(number);
  const maxRank = maxScoreRank.value;

  if (!row || maxRank <= 1) {
    return 0;
  }

  return Math.min(Math.max((maxRank - row.rank) / (maxRank - 1), 0), 1);
}

function mixColor(
  start: [number, number, number],
  end: [number, number, number],
  ratio: number,
): [number, number, number] {
  return [
    colorChannel(start[0], end[0], ratio),
    colorChannel(start[1], end[1], ratio),
    colorChannel(start[2], end[2], ratio),
  ];
}

function scoreCellStyle(number: number): Record<string, string> {
  const ratio = gradientRatio(number);
  const [red, green, blue] =
    ratio < 0.5
      ? mixColor([219, 248, 213], [71, 178, 92], ratio * 2)
      : mixColor([71, 178, 92], [10, 86, 44], (ratio - 0.5) * 2);
  const textColor = ratio > 0.56 ? "#ffffff" : "#17391f";

  return {
    "--score-bg": `rgb(${red}, ${green}, ${blue})`,
    "--score-border": `rgba(${Math.max(red - 42, 0)}, ${Math.max(green - 52, 0)}, ${Math.max(blue - 42, 0)}, 0.68)`,
    "--score-text": textColor,
  };
}

function scoreCellTitle(number: number): string {
  const row = scoreRowsByNumber.value.get(number);

  if (!row) {
    return `Number ${number}`;
  }

  return [
    `Number ${number}`,
    `Rank ${row.rank}`,
    `Score ${row.score.toFixed(4)}`,
    `Score percent ${(scorePercent(number) * 100).toFixed(1)}%`,
    `Gap-state probability ${(row.gapStateProbability * 100).toFixed(2)}%`,
    `Gap bucket ${row.gapStateBucket}`,
    `Recent hits ${row.recentHits}`,
    `Current gap ${row.currentGap}`,
  ].join(" | ");
}

onBeforeUnmount(() => {
  clearClickTimer();
});

onMounted(() => {
  void window.pylottoDesktop
    ?.loadNextPossibleDrawState()
    .then((desktopState) => {
      if (stateHasNumbers(desktopState)) {
        applyNextPossibleDrawState(desktopState);
        return;
      }

      if (stateHasNumbers(localState)) {
        saveNextPossibleDrawState();
      }
    })
    .catch(() => {
      // Local storage remains the fallback when the desktop state file is unavailable.
    });

  void loadRealDrawForDate(realDrawDate.value);
});
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell next-possible-draw-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <div class="dialog-toolbar">
        <p class="reference-pill next-draw-reference">
          Selected
          <strong>{{ nextDrawCount }}</strong>
          of
          <strong>6</strong>
        </p>
        <p class="reference-pill next-draw-reference">
          Unsure
          <strong>{{ uncertainDrawCount }}</strong>
        </p>
        <p class="reference-pill next-draw-reference">
          Deleted
          <strong>{{ droppedDrawCount }}</strong>
        </p>
        <p
          class="reference-pill next-draw-reference agreement-pill"
          :title="`Top matches ${topPickMatchCount}/6 | Average rank ${averageSelectedRank === null ? 'n/a' : averageSelectedRank.toFixed(1)}`"
        >
          Model Agreement
          <strong>{{ predictionAgreementScore }}%</strong>
          <span>{{ predictionAgreementLabel }}</span>
        </p>
        <p class="reference-pill next-draw-reference real-draw-pill">
          Guessed
          <strong>{{ realDrawMatchCount }}</strong>
          of
          <strong>6</strong>
        </p>
        <template v-if="activeTab === 'real'">
          <label class="rank-input-label real-draw-date-label">
            Date
            <input v-model="realDrawDate" type="date">
          </label>
          <button
            class="ghost-button compact-button"
            :disabled="selectedRealDrawNumbers.length === 0"
            type="button"
            @click="resetRealDrawNumbers"
          >
            Reset
          </button>
          <button
            class="action-button primary compact-button"
            :disabled="!canSaveRealDraw"
            type="button"
            @click="saveRealDraw"
          >
            {{ isSavingRealDraw ? "Saving" : "Save Draw" }}
          </button>
        </template>
        <button
          class="ghost-button compact-button"
          :disabled="planningNumberCount === 0"
          type="button"
          @click="resetNextDrawNumbers"
        >
          Reset
        </button>
      </div>

      <div class="dialog-body draws-dialog-body">
        <div v-if="activeTab === 'possible'" class="draw-section">
          <div class="draw-grid" role="grid" aria-label="Next possible draw numbers">
            <button
              v-for="number in 49"
              :key="number"
              class="draw-cell draw-cell-button"
              :class="{
                available: !droppedDrawNumbers.has(number),
                dropped: droppedDrawNumbers.has(number),
                uncertain: uncertainDrawNumbers.has(number),
                selected: nextDrawNumbers.has(number),
                unavailable:
                  droppedDrawNumbers.has(number) ||
                  (!nextDrawNumbers.has(number) && nextDrawCount >= 6),
              }"
              :aria-disabled="
                droppedDrawNumbers.has(number) ||
                (!nextDrawNumbers.has(number) && nextDrawCount >= 6)
              "
              :aria-pressed="nextDrawNumbers.has(number)"
              type="button"
              role="gridcell"
              @click="queueNextDrawToggle(number)"
              @dblclick="handlePossibleNumberDoubleClick($event, number)"
            >
              {{ number }}
            </button>
          </div>
        </div>

        <div v-else-if="activeTab === 'scoreGrid'" class="draw-section score-grid-section">
          <div class="draw-grid score-draw-grid" role="grid" :aria-label="predictiveScoreGrid.name">
            <button
              v-for="number in 49"
              :key="number"
              class="draw-cell draw-cell-button score-cell"
              :class="{
                uncertain: uncertainDrawNumbers.has(number),
                selected: nextDrawNumbers.has(number),
                topPick: scoreRowsByNumber.get(number)?.isTopPick,
                rankFocused: selectedPredictiveNumber === number,
              }"
              :style="scoreCellStyle(number)"
              :title="scoreCellTitle(number)"
              :aria-pressed="nextDrawNumbers.has(number)"
              type="button"
              role="gridcell"
              @click="selectPredictiveNumberRank(number); queueNextDrawToggle(number)"
              @dblclick="handleScoreNumberDoubleClick(number)"
            >
              {{ number }}
            </button>
          </div>

          <div class="score-grid-summary">
            <p class="reference-pill next-draw-reference">{{ predictiveScoreGrid.name }}</p>
            <p class="reference-pill next-draw-reference">
              Top
              <strong>{{ predictiveScoreGrid.topNumbers.join(", ") }}</strong>
            </p>
            <p class="reference-pill next-draw-reference">
              Window
              <strong>{{ predictiveScoreGrid.recentDrawWindow }}</strong>
            </p>
            <p class="reference-pill next-draw-reference">
              Model
              <strong>{{ predictiveScoreGrid.markovModel }}</strong>
            </p>
          </div>

          <div class="rank-navigator" aria-label="Predictive rank navigator">
            <button
              class="ghost-button compact-button"
              :disabled="selectedPredictiveRank <= 1"
              type="button"
              @click="showFirstPredictiveRank"
            >
              First
            </button>
            <button
              class="ghost-button compact-button"
              :disabled="selectedPredictiveRank <= 1"
              type="button"
              @click="showPreviousPredictiveRank"
            >
              Previous
            </button>
            <label class="rank-input-label">
              Rank
              <input
                :max="maxScoreRank"
                min="1"
                type="number"
                :value="selectedPredictiveRank"
                @input="selectPredictiveRank(Number(($event.target as HTMLInputElement).value))"
              >
            </label>
            <p class="reference-pill next-draw-reference">
              Number
              <strong>{{ selectedPredictiveNumber ?? "n/a" }}</strong>
            </p>
            <button
              class="ghost-button compact-button"
              :disabled="selectedPredictiveRank >= maxScoreRank"
              type="button"
              @click="showNextPredictiveRank"
            >
              Next
            </button>
            <button
              class="ghost-button compact-button"
              :disabled="selectedPredictiveRank >= maxScoreRank"
              type="button"
              @click="showLastPredictiveRank"
            >
              Last
            </button>
          </div>
        </div>

        <div v-else-if="activeTab === 'real'" class="draw-section real-draw-section">
          <div class="draw-grid" role="grid" aria-label="Real draw numbers">
            <button
              v-for="number in 49"
              :key="number"
              class="draw-cell draw-cell-button real-draw-cell"
              :class="{
                selected: realDrawNumbers.has(number),
                matched: realDrawNumbers.has(number) && nextDrawNumbers.has(number),
                unavailable: !realDrawNumbers.has(number) && selectedRealDrawNumbers.length >= 6,
              }"
              :aria-disabled="!realDrawNumbers.has(number) && selectedRealDrawNumbers.length >= 6"
              :aria-pressed="realDrawNumbers.has(number)"
              type="button"
              role="gridcell"
              @click="toggleRealDrawNumber(number)"
            >
              {{ number }}
            </button>
          </div>

          <div class="real-draw-result">
            <p class="reference-pill next-draw-reference">
              Real Draw
              <strong>{{ selectedRealDrawNumbers.length }}</strong>
              of
              <strong>6</strong>
            </p>
            <p class="reference-pill next-draw-reference real-draw-pill">
              Guessed
              <strong>{{ realDrawMatchCount }}</strong>
              of
              <strong>6</strong>
            </p>
            <p class="reference-pill next-draw-reference">
              Matches
              <strong>{{ realDrawMatchNumbers.length ? realDrawMatchNumbers.join(", ") : "none" }}</strong>
            </p>
          </div>

          <p v-if="realDrawSaveMessage" class="real-draw-status success">
            {{ realDrawSaveMessage }}
          </p>
          <p v-else-if="realDrawSaveError" class="real-draw-status error">
            {{ realDrawSaveError }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

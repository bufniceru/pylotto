<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import bayesianMarkovScoreJson from "../data/bayesian-markov-score.json";
import predictiveScoreGridJson from "../data/predictive-score-grid.json";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type {
  BayesianMarkovModel,
  BayesianMarkovPrediction,
  EnrichedHistory,
  FreshnessModel,
  FreshnessPrediction,
  ProximityModel,
  ProximityPrediction,
  PredictiveScoreGrid,
  PredictiveScoreNumber,
  WorkspaceTab,
  WorkspaceView,
} from "../types";

const nextDrawStorageKey = "pylotto.nextPossibleDrawNumbers";
const droppedDrawStorageKey = "pylotto.nextPossibleDrawDroppedNumbers";
const uncertainDrawStorageKey = "pylotto.nextPossibleDrawUncertainNumbers";
const possibleDrawsStorageKey = "pylotto.nextPossibleDrawPlans";
const realDrawDateStorageKey = "pylotto.realDrawDate";
const realDrawNumbersByDateStorageKey = "pylotto.realDrawNumbersByDate";
type NextDrawTab = "possible" | "scoreGrid" | "real";
interface PossibleDrawPlan {
  id: string;
  name: string;
  selectedNumbers: number[];
  droppedNumbers: number[];
  uncertainNumbers: number[];
}

interface NextPossibleDrawState {
  activePlanId: string;
  plans: PossibleDrawPlan[];
  selectedNumbers?: number[];
  droppedNumbers?: number[];
  uncertainNumbers?: number[];
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
  closeWorkspaceView: [value: WorkspaceView];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  currentUserEmail: string;
  freshnessModel: FreshnessModel;
  history: EnrichedHistory;
  proximityModel: ProximityModel;
  workspaceTabs: WorkspaceTab[];
}>();

const bayesianMarkovModel = bayesianMarkovScoreJson as BayesianMarkovModel;
const bayesianBands = [
  { id: "elite", label: "Elite", color: "#0a562c" },
  { id: "strong", label: "Strong", color: "#47b25c" },
  { id: "active", label: "Active", color: "#f0b44f" },
  { id: "soft", label: "Soft", color: "#7b8798" },
];

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

function userStorageSuffix(): string {
  return props.currentUserEmail.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_") || "guest";
}

function userStorageKey(storageKey: string): string {
  return `${storageKey}.${userStorageSuffix()}`;
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
    activePlanId: "draw-1",
    plans: [
      {
        id: "draw-1",
        name: "Draw 1",
        selectedNumbers: loadStoredNumbers(userStorageKey(nextDrawStorageKey), 6),
        droppedNumbers: loadStoredNumbers(userStorageKey(droppedDrawStorageKey)),
        uncertainNumbers: loadStoredNumbers(userStorageKey(uncertainDrawStorageKey)),
      },
    ],
  };
}

function stateHasNumbers(state: NextPossibleDrawState): boolean {
  const normalizedState = normalizeNextPossibleDrawState(state);

  return normalizedState.plans.some(
    (plan) =>
      plan.selectedNumbers.length > 0 ||
      plan.droppedNumbers.length > 0 ||
      plan.uncertainNumbers.length > 0,
  );
}

function saveStoredNumbers(storageKey: string, numbers: number[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(numbers));
  } catch {
    // Ignore storage failures; the in-memory state still works for this session.
  }
}

function createPlan(name: string, values: Partial<PossibleDrawPlan> = {}): PossibleDrawPlan {
  return {
    id: values.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    selectedNumbers: normalizeNumbers(values.selectedNumbers, 6),
    droppedNumbers: normalizeNumbers(values.droppedNumbers),
    uncertainNumbers: normalizeNumbers(values.uncertainNumbers),
  };
}

function normalizePlan(value: unknown, index: number): PossibleDrawPlan {
  const plan = typeof value === "object" && value !== null ? value as Partial<PossibleDrawPlan> : {};

  return createPlan(String(plan.name ?? `Draw ${index + 1}`), plan);
}

function normalizeNextPossibleDrawState(state: unknown): NextPossibleDrawState {
  const rawState =
    typeof state === "object" && state !== null
      ? state as Partial<NextPossibleDrawState>
      : {};
  const rawPlans = Array.isArray(rawState.plans) ? rawState.plans : [];
  const plans =
    rawPlans.length > 0
      ? rawPlans.map((plan, index) => normalizePlan(plan, index))
      : [
          createPlan("Draw 1", {
            selectedNumbers: rawState.selectedNumbers,
            droppedNumbers: rawState.droppedNumbers,
            uncertainNumbers: rawState.uncertainNumbers,
          }),
        ];
  const activePlanId = plans.some((plan) => plan.id === rawState.activePlanId)
    ? String(rawState.activePlanId)
    : plans[0].id;

  return { activePlanId, plans };
}

function loadStoredNextPossibleDrawState(): NextPossibleDrawState | null {
  try {
    const storedValue = window.localStorage.getItem(userStorageKey(possibleDrawsStorageKey));

    return storedValue === null ? null : normalizeNextPossibleDrawState(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

function saveStoredNextPossibleDrawState(state: NextPossibleDrawState): void {
  try {
    window.localStorage.setItem(
      userStorageKey(possibleDrawsStorageKey),
      JSON.stringify(normalizeNextPossibleDrawState(state)),
    );
  } catch {
    // Ignore storage failures; the in-memory state still works for this session.
  }
}

function buildCurrentState(): NextPossibleDrawState {
  const activePlan = createPlan(activePossibleDrawPlan.value?.name ?? "Draw 1", {
    id: activePlanId.value,
    selectedNumbers: [...nextDrawNumbers.value],
    droppedNumbers: [...droppedDrawNumbers.value],
    uncertainNumbers: [...uncertainDrawNumbers.value],
  });
  const nextPlans = possibleDrawPlans.value.map((plan) =>
    plan.id === activePlan.id ? activePlan : plan,
  );

  return {
    activePlanId: activePlan.id,
    plans: nextPlans.length > 0 ? nextPlans : [activePlan],
  };
}

function saveNextPossibleDrawState(): void {
  const state = buildCurrentState();

  saveStoredNextPossibleDrawState(state);
  void window.pylottoDesktop?.saveNextPossibleDrawState(state).catch(() => {
    // The local storage fallback keeps planning usable if desktop persistence fails.
  });
}

function applyNextPossibleDrawState(state: NextPossibleDrawState): void {
  const normalizedState = normalizeNextPossibleDrawState(state);
  const activePlan =
    normalizedState.plans.find((plan) => plan.id === normalizedState.activePlanId) ??
    normalizedState.plans[0];
  const selectedSet = new Set(activePlan.selectedNumbers);

  possibleDrawPlans.value = normalizedState.plans;
  activePlanId.value = activePlan.id;
  nextDrawNumbers.value = selectedSet;
  droppedDrawNumbers.value = new Set(activePlan.droppedNumbers);
  uncertainDrawNumbers.value = new Set(
    activePlan.uncertainNumbers.filter((number) => !selectedSet.has(number)),
  );
}

const localState = loadStoredNextPossibleDrawState() ?? loadLocalNextPossibleDrawState();
const initialState = normalizeNextPossibleDrawState(localState);
const initialPlan =
  initialState.plans.find((plan) => plan.id === initialState.activePlanId) ??
  initialState.plans[0];
const possibleDrawPlans = ref<PossibleDrawPlan[]>(initialState.plans);
const activePlanId = ref(initialPlan.id);
const nextDrawNumbers = ref<Set<number>>(new Set(initialPlan.selectedNumbers));
const droppedDrawNumbers = ref<Set<number>>(new Set(initialPlan.droppedNumbers));
const uncertainDrawNumbers = ref<Set<number>>(new Set(initialPlan.uncertainNumbers));
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
const selectedFreshnessNumber = ref<number | null>(null);
const activePossibleDrawPlan = computed(
  () =>
    possibleDrawPlans.value.find((plan) => plan.id === activePlanId.value) ??
    possibleDrawPlans.value[0],
);
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
const freshnessPredictionsByNumber = computed(() => {
  const predictions = new Map<number, FreshnessPrediction>();

  for (const prediction of props.freshnessModel.predictions) {
    predictions.set(prediction.number, prediction);
  }

  return predictions;
});
const selectedFreshnessPrediction = computed(() =>
  selectedFreshnessNumber.value === null
    ? null
    : freshnessPredictionsByNumber.value.get(selectedFreshnessNumber.value) ?? null,
);
const proximityPredictionsByNumber = computed(() => {
  const predictions = new Map<number, ProximityPrediction>();

  for (const prediction of props.proximityModel.predictions) {
    predictions.set(prediction.number, prediction);
  }

  return predictions;
});
const selectedProximityPrediction = computed(() =>
  selectedFreshnessNumber.value === null
    ? null
    : proximityPredictionsByNumber.value.get(selectedFreshnessNumber.value) ?? null,
);
const bayesianBucketByGap = new Map(
  bayesianMarkovModel.bucketSummaries.map((summary) => [summary.bucket, summary]),
);
const bayesianCurrentGaps = computed(() => {
  const lastSeen = new Map<number, number | null>();

  for (let number = 1; number <= bayesianMarkovModel.numberCount; number += 1) {
    lastSeen.set(number, null);
  }

  props.history.draws.forEach((draw, drawIndex) => {
    for (const number of draw.numbers) {
      lastSeen.set(number.value, drawIndex);
    }
  });

  const drawCount = props.history.draws.length;

  return new Map(
    Array.from({ length: bayesianMarkovModel.numberCount }, (_value, index) => {
      const number = index + 1;
      const seenAt = lastSeen.get(number) ?? null;

      return [number, seenAt === null ? drawCount : drawCount - 1 - seenAt];
    }),
  );
});
const bayesianPredictions = computed<BayesianMarkovPrediction[]>(() => {
  const posteriorMeans = new Map(
    Array.from({ length: bayesianMarkovModel.numberCount }, (_value, index) => {
      const number = index + 1;
      const bucket = bayesianGapBucket(bayesianCurrentGaps.value.get(number) ?? 0);
      const summary = bayesianBucketByGap.get(bucket);

      return [number, summary?.posteriorMean ?? 0];
    }),
  );
  const scaledScores = scaleBayesianScores(posteriorMeans);

  return Array.from({ length: bayesianMarkovModel.numberCount }, (_value, index) => {
    const number = index + 1;
    const currentGap = bayesianCurrentGaps.value.get(number) ?? 0;
    const bucket = bayesianGapBucket(currentGap);
    const summary = bayesianBucketByGap.get(bucket);
    const scoreValue = scaledScores.get(number) ?? 0;
    const band = bayesianBandForScore(scoreValue);

    return {
      number,
      rank: 0,
      score: scoreValue,
      currentGap,
      bucket,
      posteriorMean: summary?.posteriorMean ?? 0,
      posteriorMedian: summary?.posteriorMedian ?? 0,
      credibleLow90: summary?.credibleLow90 ?? 0,
      credibleHigh90: summary?.credibleHigh90 ?? 0,
      bandId: band.id,
      label: band.label,
    };
  })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.posteriorMean - left.posteriorMean ||
        right.currentGap - left.currentGap ||
        left.number - right.number,
    )
    .map((prediction, index) => ({
      ...prediction,
      rank: index + 1,
    }));
});
const bayesianPredictionsByNumber = computed(
  () => new Map(bayesianPredictions.value.map((prediction) => [prediction.number, prediction])),
);
const selectedBayesianPrediction = computed(() =>
  selectedFreshnessNumber.value === null
    ? null
    : bayesianPredictionsByNumber.value.get(selectedFreshnessNumber.value) ?? null,
);
const selectedFreshnessPercent = computed(() =>
  Math.min(Math.max(selectedFreshnessPrediction.value?.hitRate ?? 0, 0), 1),
);
const selectedFreshnessRankPercent = computed(() =>
  rankMeterPercent(selectedFreshnessPrediction.value?.rank),
);
const selectedProximityRankPercent = computed(() =>
  rankMeterPercent(selectedProximityPrediction.value?.rank),
);
const selectedBayesianRankPercent = computed(() =>
  rankMeterPercent(selectedBayesianPrediction.value?.rank),
);
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

function persistActivePossibleDrawPlan(): void {
  const activePlan = createPlan(activePossibleDrawPlan.value?.name ?? "Draw 1", {
    id: activePlanId.value,
    selectedNumbers: [...nextDrawNumbers.value],
    droppedNumbers: [...droppedDrawNumbers.value],
    uncertainNumbers: [...uncertainDrawNumbers.value],
  });

  possibleDrawPlans.value = possibleDrawPlans.value.map((plan) =>
    plan.id === activePlan.id ? activePlan : plan,
  );
}

function switchPossibleDrawPlan(planId: string): void {
  const nextPlan = possibleDrawPlans.value.find((plan) => plan.id === planId);

  if (!nextPlan || nextPlan.id === activePlanId.value) {
    return;
  }

  persistActivePossibleDrawPlan();
  activePlanId.value = nextPlan.id;
  nextDrawNumbers.value = new Set(nextPlan.selectedNumbers);
  droppedDrawNumbers.value = new Set(nextPlan.droppedNumbers);
  uncertainDrawNumbers.value = new Set(nextPlan.uncertainNumbers);
  selectedFreshnessNumber.value = null;
  saveNextPossibleDrawState();
}

function createPossibleDrawPlan(): void {
  persistActivePossibleDrawPlan();

  const nextPlan = createPlan(`Draw ${possibleDrawPlans.value.length + 1}`);
  possibleDrawPlans.value = [...possibleDrawPlans.value, nextPlan];
  activePlanId.value = nextPlan.id;
  nextDrawNumbers.value = new Set();
  droppedDrawNumbers.value = new Set();
  uncertainDrawNumbers.value = new Set();
  selectedFreshnessNumber.value = null;
  saveNextPossibleDrawState();
}

function deleteActivePossibleDrawPlan(): void {
  if (possibleDrawPlans.value.length <= 1) {
    resetNextDrawNumbers();
    return;
  }

  const activeIndex = possibleDrawPlans.value.findIndex((plan) => plan.id === activePlanId.value);
  const remainingPlans = possibleDrawPlans.value.filter((plan) => plan.id !== activePlanId.value);
  const nextPlan = remainingPlans[Math.min(Math.max(activeIndex, 0), remainingPlans.length - 1)];

  possibleDrawPlans.value = remainingPlans;
  activePlanId.value = nextPlan.id;
  nextDrawNumbers.value = new Set(nextPlan.selectedNumbers);
  droppedDrawNumbers.value = new Set(nextPlan.droppedNumbers);
  uncertainDrawNumbers.value = new Set(nextPlan.uncertainNumbers);
  selectedFreshnessNumber.value = null;
  saveNextPossibleDrawState();
}

watch([nextDrawNumbers, droppedDrawNumbers, uncertainDrawNumbers], () => {
  persistActivePossibleDrawPlan();
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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function rankMeterPercent(rank: number | undefined): number {
  if (!rank) {
    return 0;
  }

  return Math.max(1, ((50 - rank) / 49) * 100);
}

function freshnessBucketColor(bucketId: string | undefined): string {
  return (
    props.freshnessModel.buckets.find((bucket) => bucket.id === bucketId)?.color ?? "#7b8798"
  );
}

function proximityBucketColor(bucketId: string | undefined): string {
  return (
    props.proximityModel.buckets.find((bucket) => bucket.id === bucketId)?.color ?? "#7b8798"
  );
}

function bayesianBandColor(bandId: string | undefined): string {
  return bayesianBands.find((band) => band.id === bandId)?.color ?? "#7b8798";
}

function bayesianGapBucket(gap: number): number {
  return Math.min(Math.max(gap, 0), bayesianMarkovModel.maxGapBucket);
}

function bayesianBandForScore(scoreValue: number): { id: string; label: string } {
  if (scoreValue >= 80) {
    return { id: "elite", label: "Elite" };
  }

  if (scoreValue >= 60) {
    return { id: "strong", label: "Strong" };
  }

  if (scoreValue >= 40) {
    return { id: "active", label: "Active" };
  }

  return { id: "soft", label: "Soft" };
}

function scaleBayesianScores(values: Map<number, number>): Map<number, number> {
  const rawValues = [...values.values()];
  const minValue = Math.min(...rawValues);
  const maxValue = Math.max(...rawValues);
  const spread = maxValue - minValue;

  if (spread <= 0) {
    return new Map([...values.keys()].map((key) => [key, 0]));
  }

  return new Map(
    [...values.entries()].map(([key, value]) => [key, ((value - minValue) / spread) * 100]),
  );
}

function handlePossibleNumberClick(event: MouseEvent, number: number): void {
  if (event.ctrlKey && event.altKey) {
    clearClickTimer();
    selectedFreshnessNumber.value = number;
    return;
  }

  queueNextDrawToggle(number);
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
        @close-workspace-view="emit('closeWorkspaceView', $event)"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <div class="dialog-toolbar">
        <label class="rank-input-label possible-draw-plan-label">
          Plan
          <select
            :value="activePlanId"
            @change="switchPossibleDrawPlan(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="plan in possibleDrawPlans" :key="plan.id" :value="plan.id">
              {{ plan.name }}
            </option>
          </select>
        </label>
        <button
          class="ghost-button compact-button"
          type="button"
          @click="createPossibleDrawPlan"
        >
          New Draw
        </button>
        <button
          class="ghost-button compact-button"
          :disabled="possibleDrawPlans.length <= 1 && planningNumberCount === 0"
          type="button"
          @click="deleteActivePossibleDrawPlan"
        >
          Delete Draw
        </button>
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
        <div v-if="activeTab === 'possible'" class="draw-section possible-draw-section">
          <div class="possible-draw-layout">
            <div class="draw-grid" role="grid" aria-label="Next possible draw numbers">
              <button
                v-for="number in 49"
                :key="number"
                class="draw-cell draw-cell-button"
                :class="{
                  available: !droppedDrawNumbers.has(number),
                  dropped: droppedDrawNumbers.has(number),
                  freshnessFocused: selectedFreshnessNumber === number,
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
                @click="handlePossibleNumberClick($event, number)"
                @dblclick="handlePossibleNumberDoubleClick($event, number)"
              >
                {{ number }}
              </button>
            </div>

            <aside class="prediction-meters-panel">
              <section
                class="prediction-meter-card"
                :style="{ '--meter-color': freshnessBucketColor(selectedFreshnessPrediction?.bucketId) }"
              >
                <div class="prediction-meter-header">
                  <span>Freshness</span>
                  <strong>{{ selectedFreshnessNumber ?? "--" }}</strong>
                </div>
                <div class="prediction-meter-body">
                  <div class="prediction-meter-scale" aria-hidden="true">
                    <span>1</span>
                    <span>13</span>
                    <span>25</span>
                    <span>37</span>
                    <span>49</span>
                  </div>
                  <div
                    class="prediction-meter-track"
                    role="meter"
                    :aria-valuemin="1"
                    :aria-valuemax="49"
                    :aria-valuenow="selectedFreshnessPrediction?.rank ?? 49"
                  >
                    <span
                      class="prediction-meter-fill"
                      :style="{ height: `${selectedFreshnessRankPercent}%` }"
                    ></span>
                  </div>
                </div>
                <div class="prediction-meter-details">
                  <strong>Rank {{ selectedFreshnessPrediction?.rank ?? "n/a" }}</strong>
                  <span>{{ selectedFreshnessPrediction?.label ?? "n/a" }}</span>
                  <span>Hit {{ formatPercent(selectedFreshnessPercent) }}</span>
                  <span>Gap {{ selectedFreshnessPrediction?.currentGap ?? "new" }}</span>
                </div>
              </section>

              <section
                class="prediction-meter-card"
                :style="{ '--meter-color': proximityBucketColor(selectedProximityPrediction?.bucketId) }"
              >
                <div class="prediction-meter-header">
                  <span>Proximity</span>
                  <strong>{{ selectedFreshnessNumber ?? "--" }}</strong>
                </div>
                <div class="prediction-meter-body">
                  <div class="prediction-meter-scale" aria-hidden="true">
                    <span>1</span>
                    <span>13</span>
                    <span>25</span>
                    <span>37</span>
                    <span>49</span>
                  </div>
                  <div
                    class="prediction-meter-track"
                    role="meter"
                    :aria-valuemin="1"
                    :aria-valuemax="49"
                    :aria-valuenow="selectedProximityPrediction?.rank ?? 49"
                  >
                    <span
                      class="prediction-meter-fill"
                      :style="{ height: `${selectedProximityRankPercent}%` }"
                    ></span>
                  </div>
                </div>
                <div class="prediction-meter-details">
                  <strong>Rank {{ selectedProximityPrediction?.rank ?? "n/a" }}</strong>
                  <span>{{ selectedProximityPrediction?.label ?? "n/a" }}</span>
                  <span>Score {{ selectedProximityPrediction?.score.toFixed(4) ?? "n/a" }}</span>
                  <span>Hits {{ selectedProximityPrediction?.appearances ?? "n/a" }}</span>
                </div>
              </section>

              <section
                class="prediction-meter-card"
                :style="{ '--meter-color': bayesianBandColor(selectedBayesianPrediction?.bandId) }"
              >
                <div class="prediction-meter-header">
                  <span>Bayesian</span>
                  <strong>{{ selectedFreshnessNumber ?? "--" }}</strong>
                </div>
                <div class="prediction-meter-body">
                  <div class="prediction-meter-scale" aria-hidden="true">
                    <span>1</span>
                    <span>13</span>
                    <span>25</span>
                    <span>37</span>
                    <span>49</span>
                  </div>
                  <div
                    class="prediction-meter-track"
                    role="meter"
                    :aria-valuemin="1"
                    :aria-valuemax="49"
                    :aria-valuenow="selectedBayesianPrediction?.rank ?? 49"
                  >
                    <span
                      class="prediction-meter-fill"
                      :style="{ height: `${selectedBayesianRankPercent}%` }"
                    ></span>
                  </div>
                </div>
                <div class="prediction-meter-details">
                  <strong>Rank {{ selectedBayesianPrediction?.rank ?? "n/a" }}</strong>
                  <span>{{ selectedBayesianPrediction?.label ?? "n/a" }}</span>
                  <span>Score {{ selectedBayesianPrediction?.score.toFixed(1) ?? "n/a" }}</span>
                  <span>Mean {{ formatPercent(selectedBayesianPrediction?.posteriorMean ?? 0) }}</span>
                </div>
              </section>
            </aside>
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

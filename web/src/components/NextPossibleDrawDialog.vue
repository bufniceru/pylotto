<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { WorkspaceTab, WorkspaceView } from "../types";

const nextDrawStorageKey = "pylotto.nextPossibleDrawNumbers";
const droppedDrawStorageKey = "pylotto.nextPossibleDrawDroppedNumbers";
const uncertainDrawStorageKey = "pylotto.nextPossibleDrawUncertainNumbers";
type NextDrawTab = "possible" | "dropped";
interface NextPossibleDrawState {
  selectedNumbers: number[];
  droppedNumbers: number[];
  uncertainNumbers: number[];
}

const emit = defineEmits<{
  close: [];
  switchWorkspaceView: [value: WorkspaceView];
}>();

defineProps<{
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
  nextDrawNumbers.value = new Set(normalizeNumbers(state.selectedNumbers, 6));
  droppedDrawNumbers.value = new Set(normalizeNumbers(state.droppedNumbers));
  uncertainDrawNumbers.value = new Set(normalizeNumbers(state.uncertainNumbers));
}

const localState = loadLocalNextPossibleDrawState();
const nextDrawNumbers = ref<Set<number>>(new Set(localState.selectedNumbers));
const droppedDrawNumbers = ref<Set<number>>(new Set(localState.droppedNumbers));
const uncertainDrawNumbers = ref<Set<number>>(new Set(localState.uncertainNumbers));
const activeTab = ref<NextDrawTab>("possible");
const nextDrawCount = computed(() => nextDrawNumbers.value.size);
const droppedDrawCount = computed(() => droppedDrawNumbers.value.size);
const uncertainDrawCount = computed(() => uncertainDrawNumbers.value.size);
const availableDrawCount = computed(() => 49 - droppedDrawNumbers.value.size);
let clickTimer: ReturnType<typeof setTimeout> | null = null;

watch([nextDrawNumbers, droppedDrawNumbers, uncertainDrawNumbers], () => {
  saveNextPossibleDrawState();
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

  if (nextNumbers.has(number)) {
    nextNumbers.delete(number);
  } else if (nextNumbers.size < 6) {
    nextNumbers.add(number);
  } else {
    return;
  }

  nextDrawNumbers.value = nextNumbers;
}

function queueNextDrawToggle(number: number): void {
  clearClickTimer();
  clickTimer = setTimeout(() => {
    toggleNextDrawNumber(number);
    clickTimer = null;
  }, 220);
}

function queueDroppedDrawToggle(number: number): void {
  clearClickTimer();
  clickTimer = setTimeout(() => {
    toggleDroppedDrawNumber(number);
    clickTimer = null;
  }, 220);
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

function toggleUncertainDrawNumber(number: number): void {
  clearClickTimer();

  const nextDroppedNumbers = new Set(droppedDrawNumbers.value);
  const nextUncertainNumbers = new Set(uncertainDrawNumbers.value);

  nextDroppedNumbers.delete(number);

  if (nextUncertainNumbers.has(number)) {
    nextUncertainNumbers.delete(number);
  } else {
    nextUncertainNumbers.add(number);
  }

  droppedDrawNumbers.value = nextDroppedNumbers;
  uncertainDrawNumbers.value = nextUncertainNumbers;
}

function handleNumberDoubleClick(event: MouseEvent, number: number): void {
  if (event.ctrlKey) {
    toggleUncertainDrawNumber(number);
    return;
  }

  toggleDroppedDrawNumber(number);
}

function resetNextDrawNumbers(): void {
  nextDrawNumbers.value = new Set();
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
});
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section class="dialog-shell next-possible-draw-dialog-shell">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">File / Planning / Next Possible Draw</p>
          <h2>Next Possible Draw</h2>
        </div>
        <button class="ghost-button" type="button" @click="emit('close')">Close</button>
      </header>

      <nav class="mdi-tabs" aria-label="Open workspace views">
        <button
          v-for="tab in workspaceTabs"
          :key="tab.id"
          class="mdi-tab"
          :class="{ active: activeWorkspaceView === tab.id }"
          type="button"
          @click="emit('switchWorkspaceView', tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <nav class="view-tabs" aria-label="Next possible draw views">
        <button
          class="view-tab"
          :class="{ active: activeTab === 'possible' }"
          type="button"
          @click="activeTab = 'possible'"
        >
          Possible Draw
        </button>
        <button
          class="view-tab"
          :class="{ active: activeTab === 'dropped' }"
          type="button"
          @click="activeTab = 'dropped'"
        >
          Dropped Numbers
        </button>
      </nav>

      <div class="dialog-toolbar">
        <p class="reference-pill next-draw-reference">
          Selected
          <strong>{{ nextDrawCount }}</strong>
          of
          <strong>6</strong>
        </p>
        <p class="reference-pill next-draw-reference">
          Available
          <strong>{{ availableDrawCount }}</strong>
          of
          <strong>49</strong>
        </p>
        <p class="reference-pill next-draw-reference">
          Dropped
          <strong>{{ droppedDrawCount }}</strong>
        </p>
        <p class="reference-pill next-draw-reference">
          Unsure
          <strong>{{ uncertainDrawCount }}</strong>
        </p>
        <button
          class="ghost-button compact-button"
          :disabled="nextDrawCount === 0"
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
              @dblclick="handleNumberDoubleClick($event, number)"
            >
              {{ number }}
            </button>
          </div>
        </div>

        <div v-else class="draw-section">
          <div class="draw-grid" role="grid" aria-label="Dropped next possible draw numbers">
            <button
              v-for="number in 49"
              :key="number"
              class="draw-cell draw-cell-button"
              :class="{
                available: !droppedDrawNumbers.has(number),
                dropped: droppedDrawNumbers.has(number),
                uncertain: uncertainDrawNumbers.has(number),
                selected: nextDrawNumbers.has(number),
              }"
              :aria-pressed="droppedDrawNumbers.has(number)"
              type="button"
              role="gridcell"
              @click="queueDroppedDrawToggle(number)"
              @dblclick="handleNumberDoubleClick($event, number)"
            >
              {{ number }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

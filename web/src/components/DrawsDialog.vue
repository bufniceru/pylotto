<script setup lang="ts">
import { computed, ref, watch } from "vue";
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

const selectedDraw = computed(() => props.draws[selectedDrawIndex.value] ?? null);
const selectedNumbers = computed(
  () => new Set(selectedDraw.value?.numbers.map((number) => number.value) ?? []),
);
const displayDrawNumber = computed(() =>
  selectedDraw.value === null ? 0 : selectedDrawIndex.value + 1,
);

watch(
  () => props.draws.length,
  (drawCount) => {
    selectedDrawIndex.value = Math.max(0, drawCount - 1);
  },
);

function showFirstDraw(): void {
  selectedDrawIndex.value = 0;
}

function showPreviousDraw(): void {
  selectedDrawIndex.value = Math.max(0, selectedDrawIndex.value - 1);
}

function showNextDraw(): void {
  selectedDrawIndex.value = Math.min(props.draws.length - 1, selectedDrawIndex.value + 1);
}

function showLastDraw(): void {
  selectedDrawIndex.value = Math.max(0, props.draws.length - 1);
}
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section class="dialog-shell draws-dialog-shell">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">File / Draws</p>
          <h2>Draws</h2>
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

      <div class="dialog-body draws-dialog-body">
        <div class="draw-section">
          <h3>Viewed Draw</h3>
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
        </div>
      </div>
    </section>
  </div>
</template>

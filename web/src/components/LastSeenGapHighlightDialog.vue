<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { HighlightView, LastSeenGapHighlightModel, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  drawCount: number;
  drawCountValue: number;
  activeView: HighlightView;
  activeWorkspaceView: WorkspaceView;
  model: LastSeenGapHighlightModel;
  referenceDrawOffset: number;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  updateDrawCount: [value: number];
  previousDraw: [];
  nextDraw: [];
  switchView: [value: HighlightView];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const svgWidth = 1680;
const chartLeft = 70;
const chartTop = 90;
const chartBottom = 45;
const chartRight = 30;
const rowHeight = 30;
const chartHeight = computed(() =>
  Math.max(320, chartTop + props.model.drawCount * rowHeight + chartBottom),
);
const plotHeight = computed(() => Math.max(1, props.model.drawCount - 1) * rowHeight);
const plotWidth = svgWidth - chartLeft - chartRight;
const rowDrawIndices = computed(() =>
  Array.from({ length: props.model.drawCount }, (_value, index) => props.model.drawCount - 1 - index),
);
const longPressGap = ref<number | null>(null);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

function clearLongPressTimer(): void {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function startLongPress(gap: number): void {
  clearLongPressTimer();
  longPressTimer = setTimeout(() => {
    longPressGap.value = gap;
    longPressTimer = null;
  }, 1000);
}

function cancelLongPress(): void {
  clearLongPressTimer();
}

function closeLongPressPopup(): void {
  longPressGap.value = null;
}

function xForGap(gap: number): number {
  if (props.model.maxGap <= 0) {
    return chartLeft + plotWidth / 2;
  }

  return chartLeft + (gap / props.model.maxGap) * plotWidth;
}

function yForDraw(drawIndex: number): number {
  return chartTop + (props.model.drawCount - 1 - drawIndex) * rowHeight;
}

function displayDrawIndex(drawIndex: number): number {
  return props.model.drawCount - drawIndex;
}

const yTicks = computed(() => {
  const step = Math.max(1, Math.floor(props.model.drawCount / 30));
  const ticks: { drawIndex: number; label: number }[] = [];
  const indices = rowDrawIndices.value;

  for (let index = 0; index < indices.length; index += step) {
    const drawIndex = indices[index];
    ticks.push({
      drawIndex,
      label: displayDrawIndex(drawIndex),
    });
  }

  return ticks;
});

const gapTicks = computed(() => {
  const step = props.model.maxGap > 60 ? 5 : 1;
  const ticks: number[] = [];

  for (let gap = 0; gap <= props.model.maxGap; gap += step) {
    ticks.push(gap);
  }

  return ticks;
});

onBeforeUnmount(() => {
  clearLongPressTimer();
});
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section class="dialog-shell dialog-shell-wide">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">Statistics / Views</p>
          <h2>Last Seen Gap Highlight</h2>
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

      <nav class="view-tabs" aria-label="Last seen highlight views">
        <button
          class="view-tab"
          :class="{ active: activeView === 'number' }"
          type="button"
          @click="emit('switchView', 'number')"
        >
          Numbers
        </button>
        <button
          class="view-tab"
          :class="{ active: activeView === 'gap' }"
          type="button"
          @click="emit('switchView', 'gap')"
        >
          Gaps
        </button>
        <button
          class="view-tab"
          :class="{ active: activeView === 'difference' }"
          type="button"
          @click="emit('switchView', 'difference')"
        >
          Differences
        </button>
      </nav>

      <div class="dialog-toolbar">
        <label class="field-group">
          <span>Draw count</span>
          <input
            :value="drawCountValue"
            :max="drawCount"
            min="1"
            step="1"
            type="number"
            @input="emit('updateDrawCount', Number(($event.target as HTMLInputElement).value))"
          />
        </label>

        <button
          class="action-button"
          :disabled="referenceDrawOffset >= model.maxReferenceOffset"
          type="button"
          @click="emit('previousDraw')"
        >
          Previous Draw
        </button>

        <button
          class="action-button"
          :disabled="referenceDrawOffset <= 0"
          type="button"
          @click="emit('nextDraw')"
        >
          Next Draw
        </button>

        <p class="reference-pill">
          Reference draw:
          <strong>{{ model.referenceDrawDate ?? "none" }}</strong>
        </p>
      </div>

      <div class="dialog-body">
        <div class="chart-scroll">
          <svg :height="chartHeight" :width="svgWidth" class="highlight-chart" role="img">
            <text class="chart-title" :x="chartLeft" y="34">
              Last Draw (Index) Where Each Gap Appeared up to
              {{ model.referenceDrawDate ?? "n/a" }}
            </text>
            <text class="axis-label" :x="svgWidth / 2" :y="chartHeight - 10">Gap</text>
            <text class="axis-label" :x="18" :y="chartHeight / 2" transform="rotate(-90, 18, 240)">
              Draw Index
            </text>

            <line
              v-for="gap in gapTicks"
              :key="`v-${gap}`"
              :x1="xForGap(gap)"
              :x2="xForGap(gap)"
              :y1="chartTop - 10"
              :y2="chartTop + plotHeight + 10"
              class="vertical-guide"
              :class="{ major: gap % 5 === 0 }"
            />

            <rect
              v-if="model.referenceDrawIndex !== null"
              :x="xForGap(0) - 11"
              :y="yForDraw(model.referenceDrawIndex) - 14"
              :width="plotWidth + 22"
              :height="28"
              class="current-reference-ribbon"
            />

            <g v-for="gap in gapTicks" :key="`xt-top-${gap}`">
              <text
                v-if="gap % 5 === 0"
                :x="xForGap(gap)"
                :y="chartTop - 18"
                class="tick-label top-x-tick"
              >
                {{ gap }}
              </text>
            </g>

            <g v-for="drawIndex in rowDrawIndices" :key="`h-${drawIndex}`">
              <line
                :x1="xForGap(0)"
                :x2="xForGap(model.maxGap)"
                :y1="yForDraw(drawIndex)"
                :y2="yForDraw(drawIndex)"
                class="horizontal-guide"
                :class="{ major: displayDrawIndex(drawIndex) % 5 === 0 }"
              />
            </g>

            <g v-for="tick in yTicks" :key="`yt-${tick.drawIndex}`">
              <text :x="chartLeft - 16" :y="yForDraw(tick.drawIndex) + 4" class="tick-label y-tick">
                {{ tick.label }}
              </text>
            </g>

            <g v-for="gap in gapTicks" :key="`xt-${gap}`">
              <text
                :x="xForGap(gap)"
                :y="chartTop + plotHeight + 28"
                class="tick-label x-tick"
                :class="{ major: gap % 5 === 0 }"
              >
                {{ gap }}
              </text>
            </g>

            <g v-for="(point, index) in model.points" :key="`${point.drawIndex}-${point.gap}-${index}`">
              <circle
                :cx="xForGap(point.gap)"
                :cy="yForDraw(point.drawIndex)"
                :class="[
                  model.referenceDrawIndex !== null && point.drawIndex > model.referenceDrawIndex
                    ? 'point-reference-range'
                    : point.highlighted
                      ? 'point-highlighted'
                      : 'point-default',
                ]"
                r="13.5"
                @pointercancel="cancelLongPress"
                @pointerdown="startLongPress(point.gap)"
                @pointerleave="cancelLongPress"
                @pointerup="cancelLongPress"
              />
              <text
                :x="xForGap(point.gap)"
                :y="yForDraw(point.drawIndex) + 5"
                class="point-label"
                @pointercancel="cancelLongPress"
                @pointerdown="startLongPress(point.gap)"
                @pointerleave="cancelLongPress"
                @pointerup="cancelLongPress"
              >
                {{ point.gapGap }}
              </text>
            </g>
          </svg>
        </div>

        <div v-if="longPressGap !== null" class="number-popup-backdrop" @click="closeLongPressPopup">
          <div class="number-popup" @click.stop>
            <p class="number-popup-label">Selected Gap</p>
            <div class="number-popup-ball">
              {{ longPressGap }}
            </div>
            <button class="ghost-button" type="button" @click="closeLongPressPopup">Close</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

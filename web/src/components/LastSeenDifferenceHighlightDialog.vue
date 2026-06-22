<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import { buildLastSeenDifferenceHighlightReportSvg } from "../lib/lastSeenHighlightReport";
import type {
  HighlightView,
  LastSeenDifferenceHighlightModel,
  WorkspaceTab,
  WorkspaceView,
} from "../types";

const props = defineProps<{
  drawCount: number;
  drawCountValue: number;
  activeView: HighlightView;
  activeWorkspaceView: WorkspaceView;
  last50Model: LastSeenDifferenceHighlightModel;
  model: LastSeenDifferenceHighlightModel;
  referenceDrawOffset: number;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  closeWorkspaceView: [value: WorkspaceView];
  updateDrawCount: [value: number];
  firstDraw: [];
  latestDraw: [];
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
const longPressDifference = ref<number | null>(null);
const exportState = ref<"idle" | "saving" | "saved" | "error">("idle");
const exportedReportPath = ref<string | null>(null);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

function clearLongPressTimer(): void {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function startLongPress(difference: number): void {
  clearLongPressTimer();
  longPressTimer = setTimeout(() => {
    longPressDifference.value = difference;
    longPressTimer = null;
  }, 1000);
}

function cancelLongPress(): void {
  clearLongPressTimer();
}

function closeLongPressPopup(): void {
  longPressDifference.value = null;
}

function last50ReportFileName(): string {
  const referenceDate = props.last50Model.referenceDrawDate ?? "latest";
  return `last-seen-difference-highlight-last-50-${referenceDate}.svg`;
}

async function exportLast50Svg(): Promise<void> {
  exportState.value = "saving";
  exportedReportPath.value = null;

  try {
    const svg = buildLastSeenDifferenceHighlightReportSvg(props.last50Model);
    const result = await window.pylottoDesktop?.saveReportSvg({
      fileName: last50ReportFileName(),
      svg,
    });

    if (result === undefined) {
      throw new Error("Report export is only available in the desktop app.");
    }

    exportedReportPath.value = result.path;
    exportState.value = "saved";
  } catch {
    exportState.value = "error";
  }
}

function xForDifference(difference: number): number {
  if (props.model.maxDifference <= 1) {
    return chartLeft + plotWidth / 2;
  }

  return chartLeft + ((difference - 1) / (props.model.maxDifference - 1)) * plotWidth;
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

const differenceTicks = computed(() => {
  const step = props.model.maxDifference > 60 ? 5 : 1;
  const ticks: number[] = [];

  for (let difference = 1; difference <= props.model.maxDifference; difference += step) {
    ticks.push(difference);
  }

  return ticks;
});

onBeforeUnmount(() => {
  clearLongPressTimer();
});
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell highlight-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @close-workspace-view="emit('closeWorkspaceView', $event)"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <StatisticsReferenceNavigation
        :max-reference-draw-offset="model.maxReferenceOffset"
        :reference-draw-date="model.referenceDrawDate"
        :reference-draw-offset="referenceDrawOffset"
        @first-reference-draw="emit('firstDraw')"
        @latest-reference-draw="emit('latestDraw')"
        @next-reference-draw="emit('nextDraw')"
        @previous-reference-draw="emit('previousDraw')"
      >
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
          :disabled="exportState === 'saving' || last50Model.drawCount === 0"
          type="button"
          @click="exportLast50Svg"
        >
          {{ exportState === "saving" ? "Saving..." : "Save Last 50 SVG" }}
        </button>

        <p v-if="exportState === 'saved'" class="report-status" :title="exportedReportPath ?? ''">
          Saved SVG
        </p>
        <p v-else-if="exportState === 'error'" class="report-status error">
          SVG export failed
        </p>
      </StatisticsReferenceNavigation>

      <div class="dialog-body">
        <div class="chart-scroll">
          <svg :height="chartHeight" :width="svgWidth" class="highlight-chart" role="img">
            <text class="axis-label" :x="svgWidth / 2" :y="chartHeight - 10">
              Difference
            </text>
            <text class="axis-label" :x="18" :y="chartHeight / 2" transform="rotate(-90, 18, 240)">
              Draw Index
            </text>

            <line
              v-for="difference in differenceTicks"
              :key="`v-${difference}`"
              :x1="xForDifference(difference)"
              :x2="xForDifference(difference)"
              :y1="chartTop - 10"
              :y2="chartTop + plotHeight + 10"
              class="vertical-guide"
              :class="{ major: difference % 5 === 0 }"
            />

            <rect
              v-if="model.referenceDrawIndex !== null"
              :x="xForDifference(1) - 11"
              :y="yForDraw(model.referenceDrawIndex) - 14"
              :width="plotWidth + 22"
              :height="28"
              class="current-reference-ribbon"
            />

            <g v-for="difference in differenceTicks" :key="`xt-top-${difference}`">
              <text
                v-if="difference % 5 === 0"
                :x="xForDifference(difference)"
                :y="chartTop - 18"
                class="tick-label top-x-tick"
              >
                {{ difference }}
              </text>
            </g>

            <g v-for="drawIndex in rowDrawIndices" :key="`h-${drawIndex}`">
              <line
                :x1="xForDifference(1)"
                :x2="xForDifference(model.maxDifference)"
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

            <g v-for="difference in differenceTicks" :key="`xt-${difference}`">
              <text
                :x="xForDifference(difference)"
                :y="chartTop + plotHeight + 28"
                class="tick-label x-tick"
                :class="{ major: difference % 5 === 0 }"
              >
                {{ difference }}
              </text>
            </g>

            <g
              v-for="(point, index) in model.points"
              :key="`${point.drawIndex}-${point.difference}-${index}`"
            >
              <circle
                :cx="xForDifference(point.difference)"
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
                @pointerdown="startLongPress(point.difference)"
                @pointerleave="cancelLongPress"
                @pointerup="cancelLongPress"
              />
              <text
                :x="xForDifference(point.difference)"
                :y="yForDraw(point.drawIndex) + 5"
                class="point-label"
                @pointercancel="cancelLongPress"
                @pointerdown="startLongPress(point.difference)"
                @pointerleave="cancelLongPress"
                @pointerup="cancelLongPress"
              >
                {{ point.difference }}
              </text>
            </g>
          </svg>
        </div>

        <div
          v-if="longPressDifference !== null"
          class="number-popup-backdrop"
          @click="closeLongPressPopup"
        >
          <div class="number-popup" @click.stop>
            <p class="number-popup-label">Selected Difference</p>
            <div class="number-popup-ball">
              {{ longPressDifference }}
            </div>
            <button class="ghost-button" type="button" @click="closeLongPressPopup">Close</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

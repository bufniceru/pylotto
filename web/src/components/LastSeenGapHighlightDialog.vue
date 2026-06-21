<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import { buildLastSeenGapHighlightReportSvg } from "../lib/lastSeenHighlightReport";
import type { HighlightView, LastSeenGapHighlightModel, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  drawCount: number;
  drawCountValue: number;
  activeView: HighlightView;
  activeWorkspaceView: WorkspaceView;
  last50Model: LastSeenGapHighlightModel;
  model: LastSeenGapHighlightModel;
  referenceDrawOffset: number;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
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
const topGapRibbonY = chartTop - 48;
const topGapRibbonHeight = 30;
const pointRadius = 13.5;
const gapHighlightRibbonWidth = 9;
const topGapRibbonMatchWidth = 18;
const rowDrawIndices = computed(() =>
  Array.from({ length: props.model.drawCount }, (_value, index) => props.model.drawCount - 1 - index),
);
const longPressGap = ref<number | null>(null);
const gapNumbersPopup = ref<{ gap: number; numbers: number[] } | null>(null);
const exportState = ref<"idle" | "saving" | "saved" | "error">("idle");
const exportedReportPath = ref<string | null>(null);
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

function openGapNumbersPopup(event: MouseEvent, gap: number): void {
  if (!event.ctrlKey) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  clearLongPressTimer();

  gapNumbersPopup.value = {
    gap,
    numbers: props.model.referenceGapNumbers[gap] ?? [],
  };
}

function closeGapNumbersPopup(): void {
  gapNumbersPopup.value = null;
}

function last50ReportFileName(): string {
  const referenceDate = props.last50Model.referenceDrawDate ?? "latest";
  return `last-seen-gap-highlight-last-50-${referenceDate}.svg`;
}

async function exportLast50Svg(): Promise<void> {
  exportState.value = "saving";
  exportedReportPath.value = null;

  try {
    const svg = buildLastSeenGapHighlightReportSvg(props.last50Model);
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
const gapUnits = computed(() =>
  Array.from({ length: props.model.maxGap + 1 }, (_value, gap) => gap),
);
const referenceDrawGaps = computed(() => new Set(props.model.referenceGaps));

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
            <text class="axis-label" :x="svgWidth / 2" :y="chartHeight - 10">Gap</text>
            <text class="axis-label" :x="18" :y="chartHeight / 2" transform="rotate(-90, 18, 240)">
              Draw Index
            </text>

            <rect
              :x="xForGap(0) - 15"
              :y="topGapRibbonY"
              :width="plotWidth + 30"
              :height="topGapRibbonHeight"
              class="top-gap-ribbon"
              rx="8"
            />

            <line
              v-for="gap in gapUnits"
              :key="`rv-${gap}`"
              :x1="xForGap(gap)"
              :x2="xForGap(gap)"
              :y1="topGapRibbonY + 3"
              :y2="topGapRibbonY + topGapRibbonHeight - 3"
              class="top-gap-ribbon-stripe"
              :class="{ major: gap % 5 === 0 }"
            />

            <line
              v-for="gap in gapUnits"
              :key="`v-${gap}`"
              :x1="xForGap(gap)"
              :x2="xForGap(gap)"
              :y1="chartTop - 10"
              :y2="chartTop + plotHeight + 10"
              class="vertical-guide gap-unit-guide"
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

            <g v-for="gap in gapUnits" :key="`xt-top-${gap}`">
              <rect
                v-if="referenceDrawGaps.has(gap)"
                :x="xForGap(gap) - topGapRibbonMatchWidth / 2"
                :y="topGapRibbonY + 3"
                :width="topGapRibbonMatchWidth"
                :height="topGapRibbonHeight - 6"
                class="top-gap-ribbon-match"
                rx="6"
                @click="openGapNumbersPopup($event, gap)"
              />
              <text
                :x="xForGap(gap)"
                :y="topGapRibbonY + 21"
                class="tick-label top-x-tick gap-ribbon-label"
                :class="{ matched: referenceDrawGaps.has(gap) }"
                @click="openGapNumbersPopup($event, gap)"
              >
                {{ gap }}
                <title>Ctrl+Click to show numbers with gap {{ gap }}</title>
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

            <rect
              v-for="(point, index) in model.points.filter(
                (candidate) => candidate.highlighted && referenceDrawGaps.has(candidate.gap),
              )"
              :key="`highlight-ribbon-${point.drawIndex}-${point.gap}-${index}`"
              :x="xForGap(point.gap) - gapHighlightRibbonWidth / 2"
              :y="topGapRibbonY + topGapRibbonHeight"
              :width="gapHighlightRibbonWidth"
              :height="
                Math.max(
                  0,
                  yForDraw(point.drawIndex) - pointRadius - (topGapRibbonY + topGapRibbonHeight),
                )
              "
              class="gap-highlight-ribbon"
              rx="4.5"
            />

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
                :r="pointRadius"
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

        <div
          v-if="gapNumbersPopup !== null"
          class="number-popup-backdrop"
          @click="closeGapNumbersPopup"
        >
          <div class="number-popup gap-numbers-popup" @click.stop>
            <p class="number-popup-label">Numbers With Gap {{ gapNumbersPopup.gap }}</p>
            <div v-if="gapNumbersPopup.numbers.length > 0" class="gap-number-list">
              <span
                v-for="number in gapNumbersPopup.numbers"
                :key="number"
                class="gap-number-ball"
              >
                {{ number }}
              </span>
            </div>
            <p v-else class="number-popup-detail">No numbers have this gap.</p>
            <button class="ghost-button" type="button" @click="closeGapNumbersPopup">Close</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

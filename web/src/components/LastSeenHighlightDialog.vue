<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import { buildLastSeenHighlightReportSvg } from "../lib/lastSeenHighlightReport";
import type { HighlightView, LastSeenHighlightModel, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  drawCount: number;
  drawCountValue: number;
  activeView: HighlightView;
  activeWorkspaceView: WorkspaceView;
  last50Model: LastSeenHighlightModel;
  model: LastSeenHighlightModel;
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
const pointRadius = 13.5;
const undrawnStripWidth = (pointRadius * 2) / 3;
const chartHeight = computed(() =>
  Math.max(320, chartTop + props.model.drawCount * rowHeight + chartBottom),
);
const plotHeight = computed(() => Math.max(1, props.model.drawCount - 1) * rowHeight);
const plotWidth = svgWidth - chartLeft - chartRight;
const rowDrawIndices = computed(() =>
  Array.from({ length: props.model.drawCount }, (_value, index) => props.model.drawCount - 1 - index),
);
const undrawnStrips = computed(() => {
  if (props.model.referenceDrawIndex === null) {
    return [];
  }

  return props.model.points
    .filter(
      (point) =>
        point.highlighted &&
        props.model.referenceDrawIndex !== null &&
        point.drawIndex < props.model.referenceDrawIndex,
    )
    .map((point) => {
      const pointY = yForDraw(point.drawIndex);
      const referenceY = yForDraw(props.model.referenceDrawIndex ?? point.drawIndex);
      const topY = referenceY + pointRadius;
      const bottomY = pointY - pointRadius;

      return {
        key: `${point.drawIndex}-${point.number}`,
        x: xForNumber(point.number) - undrawnStripWidth / 2,
        y: topY,
        height: Math.max(0, bottomY - topY),
      };
    })
    .filter((strip) => strip.height > 0);
});
const numberPopup = ref<{ number: number; gapUntilCurrent: number | null } | null>(null);
const exportState = ref<"idle" | "saving" | "saved" | "error">("idle");
const exportedReportPath = ref<string | null>(null);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

function clearLongPressTimer(): void {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function startLongPress(number: number): void {
  clearLongPressTimer();
  longPressTimer = setTimeout(() => {
    numberPopup.value = { number, gapUntilCurrent: null };
    longPressTimer = null;
  }, 1000);
}

function openGapPopup(number: number, drawIndex: number): void {
  if (props.model.referenceDrawIndex === null) {
    numberPopup.value = { number, gapUntilCurrent: null };
    return;
  }

  numberPopup.value = {
    number,
    gapUntilCurrent: Math.max(0, props.model.referenceDrawIndex - drawIndex - 1),
  };
}

function handlePointPointerDown(event: PointerEvent, number: number, drawIndex: number): void {
  if (event.ctrlKey) {
    clearLongPressTimer();
    openGapPopup(number, drawIndex);
    return;
  }

  startLongPress(number);
}

function cancelLongPress(): void {
  clearLongPressTimer();
}

function closeLongPressPopup(): void {
  numberPopup.value = null;
}

function last50ReportFileName(): string {
  const referenceDate = props.last50Model.referenceDrawDate ?? "latest";
  return `last-seen-highlight-last-50-${referenceDate}.svg`;
}

async function exportLast50Svg(): Promise<void> {
  exportState.value = "saving";
  exportedReportPath.value = null;

  try {
    const svg = buildLastSeenHighlightReportSvg(props.last50Model);
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

function xForNumber(number: number): number {
  return chartLeft + ((number - 1) / 48) * plotWidth;
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
          <h2>Last Seen Highlight</h2>
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

      <StatisticsReferenceNavigation
        :max-reference-draw-offset="model.maxReferenceOffset"
        :reference-draw-date="model.referenceDrawDate"
        :reference-draw-offset="referenceDrawOffset"
        @first-reference-draw="emit('firstDraw')"
        @latest-reference-draw="emit('latestDraw')"
        @next-reference-draw="emit('nextDraw')"
        @previous-reference-draw="emit('previousDraw')"
      />

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
          :disabled="exportState === 'saving' || last50Model.drawCount === 0"
          type="button"
          @click="exportLast50Svg"
        >
          {{ exportState === "saving" ? "Saving..." : "Save Last 50 SVG" }}
        </button>

        <p class="reference-pill">
          Reference draw:
          <strong>{{ model.referenceDrawDate ?? "none" }}</strong>
        </p>

        <p v-if="exportState === 'saved'" class="report-status" :title="exportedReportPath ?? ''">
          Saved SVG
        </p>
        <p v-else-if="exportState === 'error'" class="report-status error">
          SVG export failed
        </p>
      </div>

      <div class="dialog-body">
        <div class="chart-scroll">
          <svg :height="chartHeight" :width="svgWidth" class="highlight-chart" role="img">
            <text class="chart-title" :x="chartLeft" y="34">
              Last Draw (Index) Where Each Number Appeared up to
              {{ model.referenceDrawDate ?? "n/a" }}
            </text>
            <text class="axis-label" :x="svgWidth / 2" :y="chartHeight - 10">Number</text>
            <text class="axis-label" :x="18" :y="chartHeight / 2" transform="rotate(-90, 18, 240)">
              Draw Index
            </text>

            <line
              v-for="number in 49"
              :key="`v-${number}`"
              :x1="xForNumber(number)"
              :x2="xForNumber(number)"
              :y1="chartTop - 10"
              :y2="chartTop + plotHeight + 10"
              class="vertical-guide"
              :class="{ major: number % 5 === 0 }"
            />

            <rect
              :x="xForNumber(1) - 15"
              :y="chartTop - 42"
              :width="plotWidth + 30"
              height="24"
              class="top-number-strip"
              rx="8"
            />

            <rect
              v-if="model.referenceDrawIndex !== null"
              :x="xForNumber(1) - 11"
              :y="yForDraw(model.referenceDrawIndex) - 14"
              :width="plotWidth + 22"
              :height="28"
              class="current-reference-ribbon"
            />

            <g v-for="number in 49" :key="`xt-top-${number}`">
              <text
                :x="xForNumber(number)"
                :y="chartTop - 25"
                class="tick-label top-x-tick"
              >
                {{ number }}
              </text>
            </g>

            <g v-for="drawIndex in rowDrawIndices" :key="`h-${drawIndex}`">
              <line
                :x1="xForNumber(1)"
                :x2="xForNumber(49)"
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

            <g v-for="number in 49" :key="`xt-${number}`">
              <text
                :x="xForNumber(number)"
                :y="chartTop + plotHeight + 28"
                class="tick-label x-tick"
                :class="{ major: number % 5 === 0 }"
              >
                {{ number }}
              </text>
            </g>

            <rect
              v-for="strip in undrawnStrips"
              :key="`undrawn-${strip.key}`"
              :height="strip.height"
              :width="undrawnStripWidth"
              :x="strip.x"
              :y="strip.y"
              class="undrawn-strip"
              rx="4.5"
            />

            <g v-for="point in model.points" :key="`${point.drawIndex}-${point.number}`">
              <circle
                :cx="xForNumber(point.number)"
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
                @pointerdown="handlePointPointerDown($event, point.number, point.drawIndex)"
                @pointerleave="cancelLongPress"
                @pointerup="cancelLongPress"
              />
              <text
                :x="xForNumber(point.number)"
                :y="yForDraw(point.drawIndex) + 5"
                class="point-label"
                @pointercancel="cancelLongPress"
                @pointerdown="handlePointPointerDown($event, point.number, point.drawIndex)"
                @pointerleave="cancelLongPress"
                @pointerup="cancelLongPress"
              >
                {{ point.gap }}
              </text>
            </g>
          </svg>
        </div>

        <div v-if="numberPopup !== null" class="number-popup-backdrop" @click="closeLongPressPopup">
          <div class="number-popup" @click.stop>
            <p class="number-popup-label">Selected Number</p>
            <div class="number-popup-ball">
              {{ numberPopup.number }}
            </div>
            <p v-if="numberPopup.gapUntilCurrent !== null" class="number-popup-detail">
              Gap until current draw:
              <strong>{{ numberPopup.gapUntilCurrent }}</strong>
            </p>
            <button class="ghost-button" type="button" @click="closeLongPressPopup">Close</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

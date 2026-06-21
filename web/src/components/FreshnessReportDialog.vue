<script setup lang="ts">
import { computed, ref } from "vue";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import { buildFreshnessReportSvg } from "../lib/freshnessReportSvg";
import type { EnrichedDraw, FreshnessModel, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  maxReferenceDrawOffset: number;
  model: FreshnessModel;
  nextActualDraw: EnrichedDraw | null;
  referenceDrawOffset: number;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  firstReferenceDraw: [];
  latestReferenceDraw: [];
  nextReferenceDraw: [];
  previousReferenceDraw: [];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const maxSituationCount = Math.max(...props.model.situations.map((situation) => situation.count), 1);
const maxDrawnCount = Math.max(
  ...props.model.bucketSummaries.map((summary) => summary.drawnCount),
  1,
);
const exportState = ref<"idle" | "saving" | "saved" | "error">("idle");
const exportedReportPath = ref<string | null>(null);
const hitNumbers = computed(
  () => new Set(props.nextActualDraw?.numbers.map((number) => number.value) ?? []),
);

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function gapLabel(gap: number | null): string {
  return gap === null ? "new" : String(gap);
}

function bucketColor(bucketId: string): string {
  return props.model.buckets.find((bucket) => bucket.id === bucketId)?.color ?? "#7b8798";
}

function reportFileName(): string {
  const latestDate = props.model.latestProfile?.date ?? "latest";
  return `freshness-report-${latestDate}.svg`;
}

async function exportFreshnessSvg(): Promise<void> {
  exportState.value = "saving";
  exportedReportPath.value = null;

  try {
    const svg = buildFreshnessReportSvg(props.model);
    const result = await window.pylottoDesktop?.saveReportSvg({
      fileName: reportFileName(),
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
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell freshness-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <StatisticsReferenceNavigation
        :max-reference-draw-offset="maxReferenceDrawOffset"
        :reference-draw-date="model.latestProfile?.date ?? null"
        :reference-draw-offset="referenceDrawOffset"
        @first-reference-draw="emit('firstReferenceDraw')"
        @latest-reference-draw="emit('latestReferenceDraw')"
        @next-reference-draw="emit('nextReferenceDraw')"
        @previous-reference-draw="emit('previousReferenceDraw')"
      >
        <p class="reference-pill">
          Draws
          <strong>{{ model.drawCount }}</strong>
        </p>
        <p class="reference-pill">
          Situations
          <strong>{{ model.situationCount }}</strong>
        </p>
        <button
          class="action-button"
          :disabled="exportState === 'saving' || model.drawCount === 0"
          type="button"
          @click="exportFreshnessSvg"
        >
          {{ exportState === "saving" ? "Saving..." : "Save SVG" }}
        </button>
        <p v-if="exportState === 'saved'" class="report-status" :title="exportedReportPath ?? ''">
          Saved SVG
        </p>
        <p v-else-if="exportState === 'error'" class="report-status error">
          SVG export failed
        </p>
      </StatisticsReferenceNavigation>

      <div class="dialog-body freshness-dialog-body">
        <section class="freshness-band">
          <h3>Freshness Characterization</h3>
          <div class="freshness-buckets">
            <article
              v-for="bucket in model.buckets"
              :key="bucket.id"
              class="freshness-bucket"
              :style="{ '--bucket-color': bucket.color }"
            >
              <span class="freshness-swatch"></span>
              <strong>{{ bucket.label }}</strong>
              <p>{{ bucket.description }}</p>
            </article>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Historical Bucket Frequency</h3>
            <svg class="freshness-chart" viewBox="0 0 760 320" role="img">
              <line x1="44" x2="732" y1="260" y2="260" class="freshness-axis" />
              <g
                v-for="(summary, index) in model.bucketSummaries"
                :key="summary.bucketId"
                :transform="`translate(${56 + index * 84}, 0)`"
              >
                <rect
                  :height="Math.max(2, (summary.drawnCount / maxDrawnCount) * 190)"
                  width="42"
                  x="0"
                  :y="260 - Math.max(2, (summary.drawnCount / maxDrawnCount) * 190)"
                  class="freshness-bar"
                  :style="{ fill: bucketColor(summary.bucketId) }"
                  rx="6"
                />
                <text x="21" y="284" class="freshness-chart-label">{{ summary.label }}</text>
                <text x="21" :y="248 - Math.max(2, (summary.drawnCount / maxDrawnCount) * 190)" class="freshness-chart-value">
                  {{ summary.drawnCount }}
                </text>
              </g>
            </svg>
            <div class="freshness-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Bucket</span>
                <span>Drawn</span>
                <span>Available</span>
                <span>Hit rate</span>
              </div>
              <div
                v-for="summary in model.bucketSummaries"
                :key="summary.bucketId"
                class="freshness-row"
              >
                <span>{{ summary.label }}</span>
                <span>{{ summary.drawnCount }}</span>
                <span>{{ summary.exposureCount }}</span>
                <span>{{ percent(summary.hitRate) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Latest Draw Profile</h3>
            <p class="freshness-signature">{{ model.latestProfile?.signature ?? "n/a" }}</p>
            <div class="freshness-number-list">
              <div
                v-for="number in model.latestProfile?.numbers ?? []"
                :key="number.number"
                class="freshness-number-card"
                :style="{ '--bucket-color': bucketColor(number.bucketId) }"
              >
                <strong>{{ number.number }}</strong>
                <span>{{ number.label }}</span>
                <small>gap {{ gapLabel(number.gap) }}</small>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Situation Occurrences</h3>
            <div class="freshness-situations">
              <div
                v-for="situation in model.situations.slice(0, 28)"
                :key="situation.signature"
                class="freshness-situation"
              >
                <div>
                  <strong>{{ situation.signature }}</strong>
                  <span>{{ situation.count }} times | {{ percent(situation.percent) }} | latest {{ situation.latestDate }}</span>
                </div>
                <div class="freshness-situation-bar">
                  <span :style="{ width: `${Math.max(3, (situation.count / maxSituationCount) * 100)}%` }"></span>
                </div>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Next Draw Freshness Prediction</h3>
            <div class="freshness-prediction-grid">
              <div
                v-for="prediction in model.predictions"
                :key="prediction.number"
                class="freshness-prediction-cell"
                :class="{ 'prediction-hit': hitNumbers.has(prediction.number) }"
                :style="{ '--bucket-color': bucketColor(prediction.bucketId) }"
                :title="`${prediction.label} | gap ${gapLabel(prediction.currentGap)} | hit rate ${percent(prediction.hitRate)}`"
              >
                <strong>{{ prediction.number }}</strong>
                <span>#{{ prediction.rank }}</span>
              </div>
            </div>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>No.</span>
                <span>Bucket</span>
                <span>Gap</span>
                <span>Rate</span>
              </div>
              <div
                v-for="prediction in model.predictions.slice(0, 12)"
                :key="`top-${prediction.number}`"
                class="freshness-row"
              >
                <span>{{ prediction.rank }}</span>
                <span>
                  <b
                    class="prediction-number-marker"
                    :class="{ 'prediction-hit': hitNumbers.has(prediction.number) }"
                  >
                    {{ prediction.number }}
                  </b>
                </span>
                <span>{{ prediction.label }}</span>
                <span>{{ gapLabel(prediction.currentGap) }}</span>
                <span>{{ percent(prediction.hitRate) }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

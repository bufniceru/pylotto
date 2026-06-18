<script setup lang="ts">
import { ref } from "vue";
import { buildFreshnessReportSvg } from "../lib/freshnessReportSvg";
import type { FreshnessModel, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  model: FreshnessModel;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const maxSituationCount = Math.max(...props.model.situations.map((situation) => situation.count), 1);
const maxDrawnCount = Math.max(
  ...props.model.bucketSummaries.map((summary) => summary.drawnCount),
  1,
);
const exportState = ref<"idle" | "saving" | "saved" | "error">("idle");
const exportedReportPath = ref<string | null>(null);

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
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section class="dialog-shell dialog-shell-wide">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">Statistics / Views</p>
          <h2>Freshness Report</h2>
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

      <div class="dialog-toolbar">
        <p class="reference-pill">
          Draws
          <strong>{{ model.drawCount }}</strong>
        </p>
        <p class="reference-pill">
          Situations
          <strong>{{ model.situationCount }}</strong>
        </p>
        <p class="reference-pill">
          Latest
          <strong>{{ model.latestProfile?.date ?? "n/a" }}</strong>
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
      </div>

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
                <span>{{ prediction.number }}</span>
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

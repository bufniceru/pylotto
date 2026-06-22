<script setup lang="ts">
import { computed } from "vue";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type { ChiSquareModel, EnrichedDraw, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  maxReferenceDrawOffset: number;
  model: ChiSquareModel;
  nextActualDraw: EnrichedDraw | null;
  referenceDrawOffset: number;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  closeWorkspaceView: [value: WorkspaceView];
  firstReferenceDraw: [];
  latestReferenceDraw: [];
  nextReferenceDraw: [];
  previousReferenceDraw: [];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const hitNumbers = computed(
  () => new Set(props.nextActualDraw?.numbers.map((number) => number.value) ?? []),
);
const sortedByNumber = computed(() =>
  [...props.model.numberSummaries].sort((left, right) => left.number - right.number),
);
const largestOver = computed(() =>
  props.model.numberSummaries
    .filter((summary) => summary.difference > 0)
    .sort((left, right) => right.difference - left.difference || left.number - right.number)
    .slice(0, 8),
);
const largestUnder = computed(() =>
  props.model.numberSummaries
    .filter((summary) => summary.difference < 0)
    .sort((left, right) => left.difference - right.difference || left.number - right.number)
    .slice(0, 8),
);

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function number(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function pValue(value: number): string {
  if (value < 0.0001) {
    return "<0.0001";
  }

  return value.toFixed(4);
}

function bandColor(bandId: string): string {
  return props.model.bands.find((band) => band.id === bandId)?.color ?? "#7b8798";
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${number(value)}`;
}
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell freshness-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="activeWorkspaceView"
        :workspace-tabs="workspaceTabs"
        @close-workspace-view="emit('closeWorkspaceView', $event)"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <StatisticsReferenceNavigation
        :max-reference-draw-offset="maxReferenceDrawOffset"
        :reference-draw-date="model.latestProfile.date"
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
          Chi-square
          <strong>{{ number(model.statistic) }}</strong>
        </p>
        <p class="reference-pill">
          df
          <strong>{{ model.degreesOfFreedom }}</strong>
        </p>
        <p class="reference-pill">
          p
          <strong>{{ pValue(model.pValue) }}</strong>
        </p>
      </StatisticsReferenceNavigation>

      <div class="dialog-body freshness-dialog-body">
        <section class="freshness-band">
          <h3>Chi-square Frequency Test</h3>
          <p class="freshness-signature">{{ model.interpretation }}</p>
          <div class="freshness-buckets">
            <article
              v-for="band in model.bands"
              :key="band.id"
              class="freshness-bucket"
              :style="{ '--bucket-color': band.color }"
            >
              <span class="freshness-swatch"></span>
              <strong>{{ band.label }}</strong>
              <p>{{ band.description }}</p>
            </article>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Observed vs Expected</h3>
            <svg class="freshness-chart" viewBox="0 0 760 320" role="img">
              <line x1="34" x2="732" y1="160" y2="160" class="freshness-axis" />
              <line x1="34" x2="732" y1="260" y2="260" class="freshness-axis muted" />
              <g
                v-for="summary in sortedByNumber"
                :key="summary.number"
                :transform="`translate(${38 + (summary.number - 1) * 14}, 0)`"
              >
                <rect
                  :height="Math.max(2, Math.abs(summary.residual) * 24)"
                  width="8"
                  x="0"
                  :y="summary.residual >= 0 ? 160 - Math.max(2, Math.abs(summary.residual) * 24) : 160"
                  class="freshness-bar"
                  :style="{ fill: bandColor(summary.bandId) }"
                  rx="3"
                />
                <text
                  v-if="summary.number % 4 === 1"
                  x="4"
                  y="286"
                  class="freshness-chart-label"
                >
                  {{ summary.number }}
                </text>
              </g>
            </svg>
            <div class="freshness-summary-table bayesian-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Metric</span>
                <span>Value</span>
                <span>Metric</span>
                <span>Value</span>
                <span>Baseline</span>
              </div>
              <div class="freshness-row">
                <span>Expected/no.</span>
                <span>{{ number(model.expectedPerNumber) }}</span>
                <span>Total picks</span>
                <span>{{ model.totalObserved }}</span>
                <span>Uniform 6/49</span>
              </div>
              <div class="freshness-row">
                <span>95% crit.</span>
                <span>{{ number(model.critical95) }}</span>
                <span>99% crit.</span>
                <span>{{ number(model.critical99) }}</span>
                <span>df {{ model.degreesOfFreedom }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Latest Draw Frequency Profile</h3>
            <p class="freshness-signature">{{ model.latestProfile.signature }}</p>
            <div class="freshness-number-list">
              <div
                v-for="summary in model.latestProfile.numbers"
                :key="summary.number"
                class="freshness-number-card"
                :style="{ '--bucket-color': bandColor(summary.bandId) }"
              >
                <strong>{{ summary.number }}</strong>
                <span>{{ summary.label }}</span>
                <small>obs {{ summary.observed }} | z {{ number(summary.residual) }}</small>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Largest Chi-square Contributions</h3>
            <div class="freshness-situations">
              <div
                v-for="summary in model.numberSummaries.slice(0, 24)"
                :key="summary.number"
                class="freshness-situation"
              >
                <div>
                  <strong>No. {{ summary.number }} | {{ summary.label }}</strong>
                  <span>
                    observed {{ summary.observed }} vs expected {{ number(summary.expected) }} |
                    delta {{ signed(summary.difference) }} | residual {{ number(summary.residual) }} | contribution
                    {{ number(summary.contribution) }}
                  </span>
                </div>
                <div class="freshness-situation-bar">
                  <span
                    :style="{
                      width: `${Math.max(3, (summary.contribution / model.maxContribution) * 100)}%`,
                      background: bandColor(summary.bandId),
                    }"
                  ></span>
                </div>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Frequency Direction Grid</h3>
            <div class="freshness-prediction-grid">
              <div
                v-for="summary in sortedByNumber"
                :key="summary.number"
                class="freshness-prediction-cell"
                :class="{ 'prediction-hit': hitNumbers.has(summary.number) }"
                :style="{ '--bucket-color': bandColor(summary.bandId) }"
                :title="`${summary.label} | observed ${summary.observed} | expected ${number(summary.expected)} | delta ${signed(summary.difference)} | residual ${number(summary.residual)} | share ${percent(summary.share)}`"
              >
                <strong>{{ summary.number }}</strong>
                <span>{{ signed(summary.difference) }}</span>
              </div>
            </div>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>No.</span>
                <span>Obs.</span>
                <span>Delta</span>
                <span>Z</span>
              </div>
              <div
                v-for="summary in model.numberSummaries.slice(0, 12)"
                :key="`top-${summary.number}`"
                class="freshness-row"
              >
                <span>{{ summary.rank }}</span>
                <span>
                  <b
                    class="prediction-number-marker"
                    :class="{ 'prediction-hit': hitNumbers.has(summary.number) }"
                  >
                    {{ summary.number }}
                  </b>
                </span>
                <span>{{ summary.observed }}</span>
                <span>{{ signed(summary.difference) }}</span>
                <span>{{ number(summary.residual) }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Most Over Expected</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>No.</span>
                <span>Observed</span>
                <span>Delta</span>
                <span>Z</span>
                <span>Contribution</span>
              </div>
              <div
                v-for="summary in largestOver"
                :key="`over-${summary.number}`"
                class="freshness-row"
              >
                <span>{{ summary.number }}</span>
                <span>{{ summary.observed }}</span>
                <span>{{ signed(summary.difference) }}</span>
                <span>{{ number(summary.residual) }}</span>
                <span>{{ number(summary.contribution) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Most Under Expected</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>No.</span>
                <span>Observed</span>
                <span>Delta</span>
                <span>Z</span>
                <span>Contribution</span>
              </div>
              <div
                v-for="summary in largestUnder"
                :key="`under-${summary.number}`"
                class="freshness-row"
              >
                <span>{{ summary.number }}</span>
                <span>{{ summary.observed }}</span>
                <span>{{ signed(summary.difference) }}</span>
                <span>{{ number(summary.residual) }}</span>
                <span>{{ number(summary.contribution) }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

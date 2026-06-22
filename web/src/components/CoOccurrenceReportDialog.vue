<script setup lang="ts">
import { computed } from "vue";
import StatisticsReferenceNavigation from "./StatisticsReferenceNavigation.vue";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type { CoOccurrenceModel, EnrichedDraw, WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  maxReferenceDrawOffset: number;
  model: CoOccurrenceModel;
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

const networkNodes = computed(() => {
  const numbers = new Set<number>();

  for (const edge of props.model.networkEdges) {
    numbers.add(edge.numbers[0]);
    numbers.add(edge.numbers[1]);
  }

  const ordered = [...numbers].sort((left, right) => left - right);
  const radius = 125;
  const centerX = 380;
  const centerY = 170;

  return ordered.map((number, index) => {
    const angle = (index / Math.max(ordered.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const node = props.model.nodes.find((candidate) => candidate.number === number);

    return {
      number,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      size: 7 + ((node?.weightedDegree ?? 0) / props.model.maxWeightedDegree) * 12,
    };
  });
});
const nodeByNumber = computed(
  () => new Map(networkNodes.value.map((node) => [node.number, node])),
);
const hitNumbers = computed(
  () => new Set(props.nextActualDraw?.numbers.map((number) => number.value) ?? []),
);

function number(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function bandColor(bandId: string): string {
  return props.model.bands.find((band) => band.id === bandId)?.color ?? "#7b8798";
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
          Pair events
          <strong>{{ model.totalPairEvents }}</strong>
        </p>
        <p class="reference-pill">
          Expected/pair
          <strong>{{ number(model.expectedPairCount) }}</strong>
        </p>
        <p class="reference-pill">
          Pairs
          <strong>{{ model.pairUniverseSize }}</strong>
        </p>
        <p class="reference-pill">
          Top
          <strong>{{ model.predictions.slice(0, 6).map((prediction) => prediction.number).join(", ") }}</strong>
        </p>
      </StatisticsReferenceNavigation>

      <div class="dialog-body freshness-dialog-body">
        <section class="freshness-band">
          <h3>Co-occurrence Network Analysis</h3>
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
            <h3>Strongest Pair Network</h3>
            <svg class="freshness-chart" viewBox="0 0 760 340" role="img">
              <g v-for="edge in model.networkEdges" :key="`edge-${edge.pair}`">
                <line
                  v-if="nodeByNumber.get(edge.numbers[0]) && nodeByNumber.get(edge.numbers[1])"
                  :x1="nodeByNumber.get(edge.numbers[0])?.x"
                  :y1="nodeByNumber.get(edge.numbers[0])?.y"
                  :x2="nodeByNumber.get(edge.numbers[1])?.x"
                  :y2="nodeByNumber.get(edge.numbers[1])?.y"
                  :stroke="bandColor(edge.bandId)"
                  :stroke-width="1 + (edge.count / model.maxEdgeCount) * 5"
                  stroke-opacity="0.42"
                />
              </g>
              <g v-for="node in networkNodes" :key="`node-${node.number}`">
                <circle
                  :cx="node.x"
                  :cy="node.y"
                  :r="node.size"
                  fill="#ffffff"
                  stroke="#172033"
                  stroke-width="1.4"
                />
                <text
                  :x="node.x"
                  :y="node.y + 3.5"
                  text-anchor="middle"
                  class="freshness-chart-value"
                >
                  {{ node.number }}
                </text>
              </g>
            </svg>
          </div>

          <div class="freshness-panel">
            <h3>Latest Draw Pair Profile</h3>
            <p class="freshness-signature">{{ model.latestProfile.signature }}</p>
            <div class="freshness-number-list">
              <div
                v-for="edge in model.latestProfile.edges"
                :key="`latest-${edge.pair}`"
                class="freshness-number-card"
                :style="{ '--bucket-color': bandColor(edge.bandId) }"
              >
                <strong>{{ edge.pair }}</strong>
                <span>{{ edge.label }}</span>
                <small>count {{ edge.count }} | lift {{ number(edge.lift) }}</small>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Top Co-occurring Pairs</h3>
            <div class="freshness-summary-table bayesian-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>Pair</span>
                <span>Count</span>
                <span>Lift</span>
                <span>Residual</span>
              </div>
              <div
                v-for="edge in model.edges.slice(0, 28)"
                :key="`edge-row-${edge.pair}`"
                class="freshness-row"
              >
                <span>{{ edge.rank }}</span>
                <span>{{ edge.pair }}</span>
                <span>{{ edge.count }}</span>
                <span>{{ number(edge.lift) }}</span>
                <span>{{ number(edge.residual) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Number Hubs</h3>
            <div class="freshness-summary-table bayesian-summary-table">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>No.</span>
                <span>Degree</span>
                <span>Best partner</span>
                <span>Lift</span>
              </div>
              <div
                v-for="node in model.nodes.slice(0, 28)"
                :key="`node-row-${node.number}`"
                class="freshness-row"
              >
                <span>{{ node.rank }}</span>
                <span>{{ node.number }}</span>
                <span>{{ node.weightedDegree }}</span>
                <span>{{ node.strongestPartner ?? "n/a" }} / {{ node.strongestPartnerCount }}</span>
                <span>{{ number(node.strongestPartnerLift) }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Next Draw Co-occurrence Ranking</h3>
            <div class="freshness-prediction-grid">
              <div
                v-for="prediction in model.predictions"
                :key="`prediction-${prediction.number}`"
                class="freshness-prediction-cell"
                :class="{ 'prediction-hit': hitNumbers.has(prediction.number) }"
                :style="{ '--bucket-color': bandColor(prediction.bandId) }"
                :title="`${prediction.label} | score ${number(prediction.score)} | avg lift ${number(prediction.averageLift)} | total count ${prediction.totalCount} | best partner ${prediction.strongestPartner ?? 'n/a'}`"
              >
                <strong>{{ prediction.number }}</strong>
                <span>{{ number(prediction.score, 1) }}</span>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Top Co-occurrence Picks</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Rank</span>
                <span>No.</span>
                <span>Score</span>
                <span>Avg lift</span>
                <span>Best partner</span>
              </div>
              <div
                v-for="prediction in model.predictions.slice(0, 16)"
                :key="`top-prediction-${prediction.number}`"
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
                <span>{{ number(prediction.score, 1) }}</span>
                <span>{{ number(prediction.averageLift) }}</span>
                <span>{{ prediction.strongestPartner ?? "n/a" }} / {{ prediction.strongestPartnerCount }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="freshness-grid-layout">
          <div class="freshness-panel">
            <h3>Lift Bands</h3>
            <div class="freshness-situations">
              <div
                v-for="band in model.bands"
                :key="`band-summary-${band.id}`"
                class="freshness-situation"
              >
                <div>
                  <strong>{{ band.label }}</strong>
                  <span>
                    {{ model.edges.filter((edge) => edge.bandId === band.id).length }} pairs |
                    {{ percent(model.edges.filter((edge) => edge.bandId === band.id).length / model.pairUniverseSize) }}
                  </span>
                </div>
                <div class="freshness-situation-bar">
                  <span
                    :style="{
                      width: `${Math.max(3, (model.edges.filter((edge) => edge.bandId === band.id).length / model.pairUniverseSize) * 100)}%`,
                      background: bandColor(band.id),
                    }"
                  ></span>
                </div>
              </div>
            </div>
          </div>

          <div class="freshness-panel">
            <h3>Lowest Co-occurring Pairs</h3>
            <div class="freshness-summary-table compact">
              <div class="freshness-row freshness-row-head">
                <span>Pair</span>
                <span>Count</span>
                <span>Expected</span>
                <span>Lift</span>
                <span>Share</span>
              </div>
              <div
                v-for="edge in [...model.edges].sort((left, right) => left.lift - right.lift || left.count - right.count).slice(0, 16)"
                :key="`low-edge-${edge.pair}`"
                class="freshness-row"
              >
                <span>{{ edge.pair }}</span>
                <span>{{ edge.count }}</span>
                <span>{{ number(edge.expected) }}</span>
                <span>{{ number(edge.lift) }}</span>
                <span>{{ percent(edge.share) }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

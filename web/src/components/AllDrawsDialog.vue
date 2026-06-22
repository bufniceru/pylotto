<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  generatedDrawCombinationRows,
  totalGeneratedDrawCombinations,
} from "../lib/combinations";
import WorkspaceTabs from "./WorkspaceTabs.vue";
import type { WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  close: [];
  closeWorkspaceView: [value: WorkspaceView];
  switchWorkspaceView: [value: WorkspaceView];
}>();

const batchSize = 500;
const rows = ref<ReturnType<typeof generatedDrawCombinationRows>>([]);
const isLoadingMore = ref(false);

function loadMoreRows(): void {
  if (isLoadingMore.value || rows.value.length >= totalGeneratedDrawCombinations) {
    return;
  }

  isLoadingMore.value = true;
  const nextRows = generatedDrawCombinationRows(rows.value.length, batchSize);
  rows.value = [...rows.value, ...nextRows];
  isLoadingMore.value = false;
}

function handleTableScroll(event: Event): void {
  const target = event.currentTarget as HTMLElement | null;

  if (!target) {
    return;
  }

  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 240) {
    loadMoreRows();
  }
}

onMounted(() => {
  loadMoreRows();
});
</script>

<template>
  <div class="dialog-backdrop draws-workspace-backdrop">
    <section class="dialog-shell all-draws-dialog-shell">
      <WorkspaceTabs
        :active-workspace-view="props.activeWorkspaceView"
        :workspace-tabs="props.workspaceTabs"
        @close-workspace-view="emit('closeWorkspaceView', $event)"
        @switch-workspace-view="emit('switchWorkspaceView', $event)"
      />

      <div class="all-draws-toolbar">
        <p class="reference-pill">
          Generated combinations
          <strong>{{ totalGeneratedDrawCombinations.toLocaleString() }}</strong>
        </p>
        <p class="reference-pill">
          Loaded
          <strong>{{ rows.length.toLocaleString() }}</strong>
        </p>
        <button
          class="action-button"
          :disabled="rows.length >= totalGeneratedDrawCombinations"
          type="button"
          @click="loadMoreRows"
        >
          Load More
        </button>
      </div>

      <div class="dialog-body all-draws-body">
        <div class="all-draws-table-panel" @scroll="handleTableScroll">
          <table class="draws-table all-draws-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>N1</th>
                <th>N2</th>
                <th>N3</th>
                <th>N4</th>
                <th>N5</th>
                <th>N6</th>
                <th>Numbers</th>
                <th>Sum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.index">
                <td>{{ (row.index + 1).toLocaleString() }}</td>
                <td v-for="number in row.numbers" :key="`${row.index}-${number}`">
                  {{ number }}
                </td>
                <td>{{ row.numbers.join(", ") }}</td>
                <td>{{ row.sum }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

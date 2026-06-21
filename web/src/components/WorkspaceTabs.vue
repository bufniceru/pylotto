<script setup lang="ts">
import { computed } from "vue";
import type { WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  switchWorkspaceView: [value: WorkspaceView];
}>();

const maxVisibleTabs = 7;
const visibleTabs = computed(() => {
  if (props.workspaceTabs.length <= maxVisibleTabs) {
    return props.workspaceTabs;
  }

  const activeTab = props.workspaceTabs.find((tab) => tab.id === props.activeWorkspaceView);
  const stableTabs = props.workspaceTabs.slice(0, maxVisibleTabs - 1);

  if (!activeTab || stableTabs.some((tab) => tab.id === activeTab.id)) {
    return props.workspaceTabs.slice(0, maxVisibleTabs);
  }

  return [...stableTabs, activeTab];
});

const selectedTab = computed({
  get: () => props.activeWorkspaceView,
  set: (value: WorkspaceView) => {
    emit("switchWorkspaceView", value);
  },
});
</script>

<template>
  <nav class="mdi-tabs" aria-label="Open workspace views">
    <button
      v-for="tab in visibleTabs"
      :key="tab.id"
      class="mdi-tab"
      :class="{ active: activeWorkspaceView === tab.id }"
      type="button"
      @click="emit('switchWorkspaceView', tab.id)"
    >
      {{ tab.label }}
    </button>

    <label v-if="workspaceTabs.length > maxVisibleTabs" class="mdi-tab-overflow">
      <span>More</span>
      <select v-model="selectedTab" aria-label="Select workspace tab">
        <option v-for="tab in workspaceTabs" :key="tab.id" :value="tab.id">
          {{ tab.label }}
        </option>
      </select>
    </label>
  </nav>
</template>

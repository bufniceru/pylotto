<script setup lang="ts">
import type { WorkspaceTab, WorkspaceView } from "../types";

const props = defineProps<{
  activeWorkspaceView: WorkspaceView;
  workspaceTabs: WorkspaceTab[];
}>();

const emit = defineEmits<{
  closeWorkspaceView: [value: WorkspaceView];
  switchWorkspaceView: [value: WorkspaceView];
}>();
</script>

<template>
  <nav class="mdi-tabs" aria-label="Open workspace views">
    <div
      v-for="tab in workspaceTabs"
      :key="tab.id"
      class="mdi-tab"
      :class="{ active: activeWorkspaceView === tab.id }"
    >
      <button
        class="mdi-tab-label"
        type="button"
        @click="emit('switchWorkspaceView', tab.id)"
      >
        {{ tab.label }}
      </button>
      <button
        class="mdi-tab-close"
        type="button"
        :aria-label="`Close ${tab.label}`"
        :title="`Close ${tab.label}`"
        @click.stop="emit('closeWorkspaceView', tab.id)"
      >
        x
      </button>
    </div>
  </nav>
</template>

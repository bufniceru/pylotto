<script setup lang="ts">
import { ref, watch } from "vue";
import type { AppSettings } from "../types";

const props = defineProps<{
  settings: AppSettings;
}>();

const emit = defineEmits<{
  close: [];
  save: [value: AppSettings];
}>();

const localSettings = ref<AppSettings>({ ...props.settings });

watch(
  () => props.settings,
  (settings) => {
    localSettings.value = { ...settings };
  },
  { deep: true },
);

function saveSettings(): void {
  emit("save", { ...localSettings.value });
}
</script>

<template>
  <div class="dialog-backdrop">
    <section class="dialog-shell settings-dialog-shell" aria-modal="true" role="dialog">
      <header class="dialog-header">
        <div>
          <p class="eyebrow">File</p>
          <h2>Settings</h2>
        </div>
        <button class="ghost-button compact-button" type="button" @click="emit('close')">
          Close
        </button>
      </header>

      <div class="dialog-body settings-dialog-body">
        <label class="settings-check-row">
          <input v-model="localSettings.implementLawOfLargeNumbers" type="checkbox">
          <span>Implement The Law Of Large Numbers</span>
        </label>
      </div>

      <footer class="settings-dialog-footer">
        <button class="ghost-button" type="button" @click="emit('close')">Cancel</button>
        <button class="action-button primary" type="button" @click="saveSettings">
          Save
        </button>
      </footer>
    </section>
  </div>
</template>

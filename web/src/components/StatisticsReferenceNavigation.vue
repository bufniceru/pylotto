<script setup lang="ts">
defineProps<{
  referenceDrawDate: string | null;
  referenceDrawOffset: number;
  maxReferenceDrawOffset: number;
}>();

const emit = defineEmits<{
  firstReferenceDraw: [];
  previousReferenceDraw: [];
  nextReferenceDraw: [];
  latestReferenceDraw: [];
}>();
</script>

<template>
  <div class="reference-navigation" aria-label="Reference draw navigation">
    <button
      class="reference-navigation-button"
      :disabled="referenceDrawOffset >= maxReferenceDrawOffset"
      title="Oldest reference draw"
      type="button"
      @click="emit('firstReferenceDraw')"
    >
      ⏮
    </button>
    <button
      class="reference-navigation-button"
      :disabled="referenceDrawOffset >= maxReferenceDrawOffset"
      title="Previous reference draw"
      type="button"
      @click="emit('previousReferenceDraw')"
    >
      ◀
    </button>
    <p class="reference-navigation-label">
      Reference draw
      <strong>{{ referenceDrawDate ?? "none" }}</strong>
    </p>
    <button
      class="reference-navigation-button"
      :disabled="referenceDrawOffset <= 0"
      title="Next reference draw"
      type="button"
      @click="emit('nextReferenceDraw')"
    >
      ▶
    </button>
    <button
      class="reference-navigation-button"
      :disabled="referenceDrawOffset <= 0"
      title="Latest reference draw"
      type="button"
      @click="emit('latestReferenceDraw')"
    >
      ⏭
    </button>
  </div>
</template>

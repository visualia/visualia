<script setup lang="ts">
import { watch, defineEmit, defineProps, ref } from "vue";

const props =
  defineProps<{
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const model = ref(props.modelValue || 0);

watch(model, () => emit("update:modelValue", model.value));
</script>

<template>
  <input type="range" v-model.number="model" />
</template>

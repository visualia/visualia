<script setup lang="ts">
import { watch, defineEmit, defineProps } from "vue";
import { ref as r } from "../utils";

const props =
  defineProps<{
    set?: string;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const key = props.set || "x";

r[key] = props.modelValue || props.value || 0;

watch(
  () => r[key],
  () => {
    emit("update:modelValue", r[key]);
  },
  { immediate: true }
);
</script>

<template>
  <input type="range" v-model.number="r[key]" />
</template>

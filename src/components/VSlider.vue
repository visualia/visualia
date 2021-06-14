<script setup lang="ts">
import { watch, defineEmit, defineProps, inject } from "vue";

const state = inject("state") as any;

const props =
  defineProps<{
    set?: string;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const stateKey = props.set || "x";

state[stateKey] = props.modelValue || props.value || 0;

watch(
  () => state[stateKey],
  () => {
    emit("update:modelValue", state[stateKey]);
  },
  { immediate: true }
);
</script>

<template>
  <input type="range" v-model.number="state[stateKey]" />
</template>

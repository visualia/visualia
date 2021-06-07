<script setup lang="ts">
import { watch, defineEmit, defineProps } from "vue";
import { state } from "../utils";

const props =
  defineProps<{
    set?: string;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const stateKey = props.set || "x";

state[stateKey] = props.modelValue || 0;

watch(
  () => state[stateKey],
  () => {
    emit("update:modelValue", state[stateKey]);
  },
  { immediate: true }
);
</script>

<template>
  <input class="Slider" type="range" v-model.number="state[stateKey]" />
</template>

<style scoped>
.Slider {
  display: block;
  margin: 0.5em 0;
}
</style>

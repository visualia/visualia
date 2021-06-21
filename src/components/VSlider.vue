<script setup lang="ts">
import { watch, defineEmit, defineProps } from "vue";
import { $ref } from "../utils";

const props =
  defineProps<{
    set?: string;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const key = props.set || "x";

$ref[key] = props.modelValue || props.value || 0;

watch(
  () => $ref[key],
  () => {
    emit("update:modelValue", $ref[key]);
  },
  { immediate: true }
);
</script>

<template>
  <input type="range" v-model.number="$ref[key]" />
</template>

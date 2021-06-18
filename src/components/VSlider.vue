<script setup lang="ts">
import { watch, defineEmit, defineProps, inject } from "vue";
import { v } from "../utils";

const props =
  defineProps<{
    set?: string;
    v?: string;
    vvv?: string;
    data?: string;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const vKey = props.set || props.v || props.vvv || props.data || "x";

v[vKey] = props.modelValue || props.value || 0;

watch(
  () => v[vKey],
  () => {
    emit("update:modelValue", v[vKey]);
  },
  { immediate: true }
);
</script>

<template>
  <input type="range" v-model.number="v[vKey]" />
</template>

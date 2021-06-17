<script setup lang="ts">
import { defineEmit, defineProps, inject, onMounted, ref, watch } from "vue";
import anime from "animejs";
import { v } from "../utils";

const props =
  defineProps<{
    set?: string;
    v?: string;
    duration?: number;
    min?: number;
    max?: number;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const vKey = props.set || props.v || "x";

const min = parseFloat(String(props.min)) || props.value || 0;
const max = parseFloat(String(props.max)) || 100;

const progress = ref(min);

onMounted(() => {
  anime({
    targets: progress,
    value: [min, max],
    autoplay: true,
    duration: props.duration || 1000,
    easing: "linear",
    loop: true,
  });
});

watch(
  progress,
  () => {
    v[vKey] = progress.value;
    emit("update:modelValue", v[vKey]);
  },
  { immediate: true }
);
</script>

<template></template>

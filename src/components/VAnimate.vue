<script setup lang="ts">
import { defineEmit, defineProps, onMounted, ref, watch } from "vue";
import anime from "animejs";

const props =
  defineProps<{
    duration?: number;
    min?: number;
    max?: number;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

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
    emit("update:modelValue", progress.value);
  },
  { immediate: true }
);
</script>

<template></template>

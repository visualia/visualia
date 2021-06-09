<script setup lang="ts">
import { defineEmit, defineProps, watch } from "vue";
import anime from "animejs";
import { state } from "../utils";

const props =
  defineProps<{
    set?: string;
    duration?: number;
    min?: number | string;
    max?: number | string;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const stateKey = props.set || "x";

const min = parseFloat(String(props.min)) || props.value || 0;
const max = parseFloat(String(props.max)) || 100;

const animate = anime({
  autoplay: false,
  value: [min, max],
  duration: props.duration || 10_000,
  easing: "linear",
  loop: true,
  update: ({ progress }) => {
    state[stateKey] = progress;
    emit("update:modelValue", state[stateKey]);
  },
});

const onPause = () => animate.pause();

const onPlay = () => animate.play();

const onToggle = () => (animate.paused ? animate.play() : animate.pause());
</script>

<template>
  <button v-on:click="onToggle">Toggle animation</button>
</template>

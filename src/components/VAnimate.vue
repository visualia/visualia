<script setup lang="ts">
import { defineEmit, defineProps, onMounted, ref, watch } from "vue";
import anime from "animejs";
/*
import { v } from "../utils";

const props =
  defineProps<{
    set?: string;
    v?: string;
    vvv?: string;
    data?: string;
    duration?: number;
    min?: number;
    max?: number;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const vKey = props.set || props.v || props.vvv || props.data || "x";
*/

const toNumber = (value: string | number) => parseFloat(String(value));

const props =
  defineProps<{
    duration?: number | string;
    min?: number | string;
    max?: number | string;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const min = toNumber(props.min || 0);
const max = toNumber(props.max || 100);
const model = ref(min);

onMounted(() => {
  anime({
    targets: model,
    value: [min, max],
    autoplay: true,
    duration: toNumber(props.duration || 5000),
    easing: "linear",
    loop: true,
  });
});
// @TODO Immmediate?
watch(model, () => emit("update:modelValue", model.value));
</script>

<template></template>

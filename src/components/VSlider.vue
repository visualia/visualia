<script setup lang="ts">
import { watch, defineEmit, defineProps, ref } from "vue";
import { set } from "../utils";

const props =
  defineProps<{
    value?: number;
    set?: string;
    modelValue?: number;
  }>();
const emit = defineEmit<(e: "update:modelValue", value: number) => number>();
const progress = ref(props.value || 0);
watch(
  progress,
  () => {
    emit("update:modelValue", progress.value!);
    if (props.set) {
      set(props.set, progress.value!);
    }
  },
  { immediate: true }
);
</script>

<template>
  <input type="range" v-model.number="progress" />
</template>

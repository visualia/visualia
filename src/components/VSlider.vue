<script setup lang="ts">
import { watch, defineEmit, defineProps, ref } from "vue";

const props =
  defineProps<{
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const value = ref(props.value || 0);

watch(
  value,
  () => {
    emit("update:modelValue", value.value!);
  },
  { immediate: true }
);
</script>

<template>
  <input type="range" v-model.number="value" />
</template>

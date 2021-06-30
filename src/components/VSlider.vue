<script setup lang="ts">
import { defineEmit, defineProps, computed } from "vue";

const props =
  defineProps<{
    set?: string;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: number) => number>();

const progress = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit("update:modelValue", value!);
  },
});
</script>

<template>
  <input type="range" v-model.number="progress" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { set } from "../utils";
const props =
  defineProps<{
    set?: string;
    value?: number;
    modelValue?: number;
  }>();

const emit = defineEmits<(e: "update:modelValue", value: number) => number>();

const progress = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit("update:modelValue", value!);
    if (props.set) {
      set(props.set, value!);
    }
  },
});

emit("update:modelValue", props.modelValue || props.value || 0);
</script>

<template>
  <input type="range" v-model.number="progress" />
</template>

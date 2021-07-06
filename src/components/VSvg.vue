<script setup lang="ts">
import { computed } from "vue";

const props =
  defineProps<{ width: number | string; height: number | string }>();

const size = computed(() => {
  const padding = 10;
  const width = parseFloat(String(props.width));
  const height = parseFloat(String(props.width));
  const viewBox = `-${padding} -${padding} ${width + padding} ${
    height + padding
  }`;
  return { width, height, viewBox };
});
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size.width"
    :height="size.height"
    :view-box.camel="size.viewBox"
  >
    <slot />
  </svg>
</template>

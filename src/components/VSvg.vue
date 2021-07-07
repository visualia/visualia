<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  width: number | string;
  height: number | string;
  viewBox?: string;
  padding?: number | string; // 10 by default
}>();

const size = computed(() => {
  const padding = parseFloat(String(props.padding || 10));
  const width = parseFloat(String(props.width)) + padding * 2;
  const height = parseFloat(String(props.width)) + padding * 2;
  const viewBox = `-${padding} -${padding} ${width} ${height}`;
  const style = {
    maxWidth: `${width}px`,
    // transform: `translate(${-padding}px,${-padding}px)`,
  };
  return { width, height, viewBox, style };
});
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :view-box.camel="size.viewBox"
    :style="size.style"
  >
    <slot />
  </svg>
</template>

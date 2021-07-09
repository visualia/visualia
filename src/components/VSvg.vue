<script setup lang="ts">
import { computed, ref } from "vue";
import { on, useSvgDownload } from "../utils";

const props = defineProps<{
  id?: string;
  width: number | string;
  height: number | string;
  viewBox?: string;
  padding?: number | string; // 0 by default
  centered?: boolean;
}>();

const emitModel =
  defineEmits<
    (
      e: "update:modelValue",
      value: { x: number; y: number; pressed: boolean }
    ) => { x: number; y: number; pressed: boolean }
  >();

const size = computed(() => {
  const padding = parseFloat(String(props.padding || 0));
  const width = parseFloat(String(props.width)) + padding * 2;
  const height = parseFloat(String(props.height)) + padding * 2;
  const viewBox = props.centered
    ? `-${width / 2} -${height / 2} ${width} ${height}`
    : `-${padding} -${padding} ${width} ${height}`;
  const style = {
    maxWidth: `${width}px`,
    //transform: `translate(${-padding}px,${-padding}px)`,
  };
  return { width, height, viewBox, style };
});

const svgRef = ref(null);
const groupRef = ref(null);

const download = useSvgDownload(svgRef, props.id);

on("download", (id: string) => {
  if (props.id && props.id === id) {
    download();
  }
});
</script>

<template>
  <svg
    ref="svgRef"
    xmlns="http://www.w3.org/2000/svg"
    :view-box.camel="size.viewBox"
    :style="size.style"
  >
    <g ref="groupRef">
      <slot />
    </g>
  </svg>
</template>

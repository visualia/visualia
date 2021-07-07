<script setup lang="ts">
import { computed, ref, watch, watchEffect } from "vue";
import { on } from "../utils";

function useSvgDownload(svgRef: any, filename: string = "visualia") {
  const download = () => {
    if (svgRef.value) {
      const svgBlob = new Blob([svgRef.value!.outerHTML], {
        type: "image/svg+xml",
      });
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.svg`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };
  return download;
}

function useSvgMouse(svgRef: any, groupRef: any) {
  const mouse = ref({ x: 0, y: 0 });
  const onMousemove = (e: any) => {
    if (svgRef && groupRef) {
      let point = svgRef.value.createSVGPoint();
      point.x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      point.y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      let ctm = groupRef.value.getScreenCTM();
      if ((ctm = ctm.inverse())) {
        point = point.matrixTransform(ctm);
      }
      mouse.value = { x: Math.floor(point.x), y: Math.floor(point.y) };
    }
  };
  return { onMousemove, mouse };
}

const props = defineProps<{
  id?: string;
  width: number | string;
  height: number | string;
  viewBox?: string;
  padding?: number | string; // 10 by default
}>();

const emitModel =
  defineEmits<
    (
      e: "update:modelValue",
      value: { x: number; y: number }
    ) => { x: number; y: number }
  >();

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

const svgRef = ref(null);
const groupRef = ref(null);

const download = useSvgDownload(svgRef, props.id);
const { onMousemove, mouse } = useSvgMouse(svgRef, groupRef);

on("download", (id: string) => {
  if (props.id && props.id === id) {
    download();
  }
});

watch(
  mouse,
  () => {
    emitModel("update:modelValue", mouse.value);
  },
  { immediate: true }
);
</script>

<template>
  <svg
    ref="svgRef"
    xmlns="http://www.w3.org/2000/svg"
    :view-box.camel="size.viewBox"
    :style="size.style"
    v-on:mousemove="onMousemove"
  >
    <g ref="groupRef">
      <slot />
    </g>
  </svg>
</template>

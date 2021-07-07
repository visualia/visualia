<script setup lang="ts">
import { computed, ref } from "vue";
import { receive } from "../utils";

const useSvgDownload = (el: any) => {
  const download = () => {
    if (el.value) {
      const svgBlob = new Blob([el.value!.outerHTML], {
        type: "image/svg+xml",
      });
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "visualia.svg");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };
  return download;
};

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

const svgRef = ref(null);
const download = useSvgDownload(svgRef);
receive("download", () => download());
</script>

<template>
  <svg
    ref="svgRef"
    xmlns="http://www.w3.org/2000/svg"
    :view-box.camel="size.viewBox"
    :style="size.style"
  >
    <slot />
  </svg>
</template>

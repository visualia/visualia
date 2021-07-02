<script setup lang="ts">
import { computed, defineEmit, defineProps, ref, useContext, watch } from "vue";
import { useMouse, useMouseInElement, useMousePressed } from "@vueuse/core";
import { v } from "../utils";

const { slots } = useContext();

// const { x, y } = useMouse();
// watch([x, y], () => (v.mouse = { x, y }));

const isSlot = computed(() => slots.default?.().length);

const target = ref(null);

const { x, y } = useMouse();
const { elementX, elementY, isOutside } = useMouseInElement(target);
const { pressed } = useMousePressed({ target });

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
    modelValue?: any;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: any) => number>();

watch([x, y, elementX, elementY], () => {
  if (isSlot.value) {
    v.mouse = {
      x: elementX.value,
      y: elementY.value,
      pressed,
      inside: !isOutside.value,
    };
  } else {
    v.mouse = { x: x.value, y: y.value, pressed };
  }
});

watch(
  () => v.mouse,
  () => {
    console.log(v.mouse);
    emit("update:modelValue", v.mouse);
  }
);
</script>

<template>
  <div v-if="isSlot" style="display: grid; grid-template-columns: auto 1fr">
    <div ref="target">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useContext, watch } from "vue";
import { useMouse, useMouseInElement } from "@vueuse/core";
import { state, get } from "../utils";

const { slots } = useContext();

// const { x, y } = useMouse();
// watch([x, y], () => (state.mouse = { x, y }));

const isSlot = computed(() => slots.default?.().length);

const target = ref(null);
const { x, y } = useMouse();
const { elementX, elementY, isOutside } = useMouseInElement(target);
watch([x, y, elementX, elementY], () => {
  if (isSlot.value) {
    if (!isOutside.value) {
      state.mouse = { x: elementX.value, y: elementY.value };
    }
  }
  if (!isSlot.value) {
    state.mouse = { x: x.value, y: y.value };
  }
});
</script>

<template>
  <div v-if="isSlot">
    <div ref="target" style="display: inline-flex"><slot /></div>
  </div>
</template>

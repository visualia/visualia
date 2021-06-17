<script setup lang="ts">
import { computed, ref, useContext, watch } from "vue";
import { useMouse, useMouseInElement, useMousePressed } from "@vueuse/core";
import { state, get } from "../utils";

const { slots } = useContext();

// const { x, y } = useMouse();
// watch([x, y], () => (state.mouse = { x, y }));

const isSlot = computed(() => slots.default?.().length);

const target = ref(null);

const { x, y } = useMouse();
const { elementX, elementY, isOutside } = useMouseInElement(target);
const { pressed } = useMousePressed({ target });

watch([x, y, elementX, elementY], () => {
  if (isSlot.value) {
    if (!isOutside.value) {
      state.mouse = {
        x: elementX.value,
        y: elementY.value,
        pressed,
        outside: isOutside,
      };
    }
  }
  if (!isSlot.value) {
    state.mouse = { x: x.value, y: y.value, pressed };
  }
});
</script>

<template>
  <div v-if="isSlot" style="display: grid; grid-template-columns: auto 1fr">
    <div ref="target" style="border: 1px solid red">
      <slot />
    </div>
  </div>
</template>

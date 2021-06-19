<script setup lang="ts">
import { computed, defineEmit, defineProps, ref, useContext, watch } from "vue";
import { useMouseInElement, useMousePressed } from "@vueuse/core";

const { slots } = useContext();
const isSlot = computed(() => slots.default?.().length);
const target = ref(null);
const mouse = ref({ x: 0, y: 0, pressed: false, inside: true });

const { x, y, elementX, elementY, isOutside } = useMouseInElement(target);
const { pressed } = useMousePressed({ target });

const props =
  defineProps<{
    modelValue?: any;
  }>();

const emit = defineEmit<(e: "update:modelValue", value: any) => number>();

watch([x, y, elementX, elementY, pressed, isOutside], () => {
  if (isSlot.value) {
    mouse.value = {
      x: Math.floor(elementX.value),
      y: Math.floor(elementY.value),
      pressed: pressed.value,
      inside: !isOutside.value,
    };
  } else {
    mouse.value = {
      x: x.value,
      y: y.value,
      pressed: pressed.value,
      inside: true,
    };
  }
  emit("update:modelValue", mouse.value);
});
</script>

<template>
  <div v-if="isSlot" style="display: grid; grid-template-columns: auto 1fr">
    <div ref="target">
      <slot />
    </div>
  </div>
</template>

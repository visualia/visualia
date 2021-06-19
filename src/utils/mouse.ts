import { computed, onMounted, ref, useContext, watch, watchEffect } from "vue";
import {
  useMouseInElement,
  useMousePressed,
  MaybeElementRef,
  tryOnMounted,
} from "@vueuse/core";

export function useBla(target: any) {
  const a = ref(1);
  tryOnMounted(() => {
    a.value = 2;
    console.log(target);
  });
  return a;
}

export function useMouse(target: MaybeElementRef) {
  const { elementX, elementY, isOutside } = useMouseInElement(target);
  const { pressed } = useMousePressed({ target });

  const mouse = ref({ x: 0, y: 0, pressed: false, inside: true });

  onMounted(() => {
    console.log(target);
    watch([elementX, elementY, isOutside, pressed], () => {
      mouse.value = {
        x: elementX.value,
        y: elementY.value,
        pressed: pressed.value,
        inside: !isOutside.value,
      };
    });
  });
  return mouse;
}

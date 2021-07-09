import { defineAsyncComponent } from "vue";

export const VMath = defineAsyncComponent(() => import("./VMath.vue"));

export { default as VAnimate } from "./VAnimate.vue";
export { default as VSlider } from "./VSlider.vue";
export { default as VSvg } from "./VSvg.vue";

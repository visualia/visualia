<script setup>
import { ref, onMounted } from "vue";
import { get, set } from "../../../src";

const sketch = (s) => {
  s.setup = () => {
    s.createCanvas(400, 400);
    s.stroke(255, 0, 0, 100);
    s.noFill();
  };
  s.draw = () => {
    s.circle(200, 200, get("r", 50));
  };
};

const sketchRef = ref(null);
onMounted(async () => {
  const { default: p5 } = await import("p5");
  new p5(sketch, sketchRef.value);
});
</script>

<template>
  <div ref="sketchRef" />
</template>

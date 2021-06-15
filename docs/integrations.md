```vue
<script setup>
import { ref, onMounted } from "vue";
import p5 from "p5";
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
onMounted(() => {
  new p5(sketch, sketchRef.value);
});
</script>

<template>
  <div ref="sketchRef" />
</template>
```

To use the p5 component on the page, you will need to import it in a `<script setup />` tag and then

<script setup>
import P5Example from "./.vitepress/components/P5Example.vue";
</script>

<p5-example />

<v-slider set="r" :value="50" max="400" />

> r is {{ get('r') }}

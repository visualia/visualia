# Integrations

## p5

Creative coding framework [p5](https://p5js.org/), a popular implementation of Processing framework in Javascript, can easily integrated with Visualia and they can even share global variables.

To use p5 in Vue and Visualia, you will need to wrap the sketch into the component and p5 [instance mode](https://github.com/processing/p5.js/wiki/Global-and-instance-mode), prefixing all commands with a sketch function `s` argument.

```vue
<!-- /docs/.vitepress/components/P5Example.vue -->

<script setup>
import { ref, onMounted } from "vue";
import { get } from "visualia";

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

// To support server-side rendering,
// we need to wrap p5 loading into onMounted
// and import the library dynamically

onMounted(async () => {
  const { default: p5 } = await import("p5");
  new p5(sketch, sketchRef.value);
});
</script>

<template>
  <div ref="sketchRef" />
</template>
```

To use the p5 component `P5Example` on the page, you will need to import it with `<script setup />` and add it to the markdown document as `<p5-example />`.

```md
<script setup>
import P5Example from "./.vitepress/components/P5Example.vue";
</script>

<p5-example />

<v-slider set="r" :value="50" max="400" />
> r is {{ get('r') }}
```

<script setup>
import P5Example from "./.vitepress/components/P5Example.vue";
</script>

<p5-example />

<v-slider set="r" :value="50" max="400" />
> r is {{ get('r') }}

#### See also

https://visualia.github.io/visualia_original/#integrations_p5

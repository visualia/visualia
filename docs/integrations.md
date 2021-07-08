# Integrations

## p5

[p5](https://p5js.org/), a popular creative coding framework can easily integrated with Visualia and they can even share global variables.

#### Inline the p5 sketch onto the page

To use p5 in Vue and Visualia, you will need to wrap the sketch into the `<script setup>` tags and use p5 [instance mode](https://github.com/processing/p5.js/wiki/Global-and-instance-mode), prefixing all p5 commands with `s.`:

```vue
<script setup>
import { ref, onMounted } from "vue";
import { v } from "visualia";

const sketch = (s) => {
  s.setup = () => {
    s.createCanvas(400, 400);
    s.stroke(255, 0, 0, 100);
    s.noFill();
  };
  s.draw = () => {
    s.circle(200, 200, v.r ?? 50);
  };
};

const p5ref = ref(null);

onMounted(async () => {
  const { default: p5 } = await import("p5");
  new p5(sketch, p5ref.value);
});
</script>

<!--
Wrap the section below into a template when you
want to use it as a separate .vue component
-->

<!-- <template> -->

<div ref="p5ref" />
<v-slider v-model="v.r" :value="50" max="400" />
> v.r is {{ v.r }}

<!-- </template> -->
```

<script setup>
import { ref, onMounted } from "vue";
import { v } from "../src";

const sketch = (s) => {
  s.setup = () => {
    s.createCanvas(400, 400);
    s.stroke(255, 0, 0, 100);
    s.noFill();
  };
  s.draw = () => {
    s.circle(200, 200, v.r ?? 50);
  };
};

const p5ref = ref(null);

onMounted(async () => {
  const { default: p5 } = await import("p5");
  new p5(sketch, p5ref.value);
});
</script>

<div ref="p5ref" />

<v-slider v-model="v.r" :value="50" max="400" />
> v.r is {{ v.r }}

#### Using p5 sketch in a separate Vue component

Due to the technical limitations, only a single `<script setup>` tag can exist on a Markdown document. When you want to add more p5 sketches to the page, it is recommended to extract them to separate Vue components.

Using the example above, move the code into a separate file `P5Example.vue` in the sample directory as Markdown file, and add `<template></template>` tags as shown in the code.

In your Markdown page, import and display Vue component:

```md
<script setup>
import P5Example from "./P5Example.vue"
</script>

<P5Example />
```

#### Prior art

https://visualia.github.io/visualia_original/#integrations_p5

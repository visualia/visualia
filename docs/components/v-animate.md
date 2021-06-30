# v-animate

Component that changes numeric value over time.

#### Props

`<v-animate />` component accepts the following props:

```ts
const props =
  defineProps<{
    duration?: number; // Animation duration in millisecons. By default it's 5000 milliseconds / 5 seconds.
    min?: number; // minimum value. `0` by default.
    max?: number; // maximum value to animate to. `100` by default.
    value?: number;
    modelValue?: number;
  }>();
```

#### Usage with global variable

To animate a [global variable](/utils/variables), you need to use `v-model="v.x"` where `x` is a variable name:

```md
<v-animate v-model="v.x" :max="360" />

> The value of v.x is {{ v.x }}
```

<v-animate v-model="v.x" :max="360" />

> The value of v.x is {{ v.x }}

You can use animated value to control the SVG circle's [cx](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/cx) attribute to move it along x axis:

```md{2}
<svg width="360" height="40">
  <circle :cx="v.x" cy="20" r="10" />
</svg>
```

<svg width="360" height="40">
  <circle :cx="v.x" cy="20" r="10" />
</svg>

Using the [trigonometry functions](/utils/trig) it's possible to convert `x` value into circular motion:

```md{4,5}
<svg width="360" height="360">
  <circle cx="180" cy="180" r="100" stroke="black" fill="none" />
  <circle
    :cx="pol2car(v.x, 100).x + 180"
    :cy="pol2car(v.x, 100).y + 180"
    r="10"
  />
</svg>
```

<svg width="360" height="360">
  <circle cx="180" cy="180" r="100" stroke="black" fill="none" /> 
  <circle
    :cx="pol2car(x, 100).x + 180"
    :cy="pol2car(x, 100).y + 180"
    r="10"
  />
</svg>

#### Usage with local variable

To animate a local variable, you first define a variable `x` and use `v-model` to animate it:

```md
<script setup>
ref: x = 0
</script>

<v-animate v-model="x" :max="360" />

> The value of x is {{ x }}
```

<script setup>
ref: x = 0
</script>

<v-animate v-model="x" :max="360" />

> The value of x is {{ x }}

#### Usage in custom components

`<v-animate>` can also be used in Vue components, using `v-model` to animate reactive variable `x`:

```md
<!-- /src/App.vue -->

<script setup>
  import { ref } from 'vue'
  import { VAnimate } from 'visualia'
  const x = ref(0)
  // Use x.value to access the animated value
</script>

<template>
  <v-animate v-model="x" />
</template>
```

#### See also

https://designstem.github.io/fachwerk/docs/#/f-animate

https://visualia.github.io/visualia_original/#live-variables_animate

# v-slider

Component that changes numeric variable with a slider.

#### Usage with global variable

To animate a [global variable](/utils/variables), you need to use `v-model="v.x"` where `x` is a variable name:

```md
<v-slider v-model="v.x" />

> The value of x is {{ v.x }}
```

<v-slider set="x"  />

> The value of x is {{ v.x }}

You can use `v.x` value to control the SVG[<circle />](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle) element (or anything, really) on the page:

```md{2}
<svg width="400" height="40">
  <circle :cx="v.x" cy="20" r="10" />
</svg>
```

<svg width="400" height="40">
  <circle :cx="v.x" cy="20" r="10" />
</svg>

#### Setting attributes

Since `<v-slider />` is a lightweight wrapper around `<input type="range">` so all the [input element attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range), including `min`, `max` and `step` also work.

```md
<v-slider v-model="v.x2" max="400" step="50" />

> The value of x2 is {{ v.x2 }}
```

<v-slider v-model="v.x2" max="400" step="50" />

> The value of x2 is {{ v.x2 }}

<svg width="400" height="40">
  <circle :cx="v.x2" cy="20" r="10" />
</svg>

Note that `step` attribute allows to use `any` value that converts allows to use a floating point numbers for those _smoooth_ interactions.

```md
<v-slider v-model="v.x3" max="400" step="any" />

> The value of x3 is {{ v.x3 }}
```

<v-slider v-model="v.x3" max="400" step="any" />

> The value of x3 is {{ v.x3 }}

<svg width="400" height="40">
  <circle :cx="v.x3" cy="20" r="10" />
</svg>

#### Usage with local variable

To animate a local variable, you first define a variable `x` and use `v-model` to animate it:

```md{5}
<script setup>
ref: x = 0
</script>

<v-slider v-model="x" />

> The value of x is {{ x }}
```

<script setup>
ref: x = 0
</script>

<v-slider v-model="x" />

> The value of x is {{ x }}

#### Usage in custom components

`<v-slider />` can also be used in Vue components, using `v-model` to animate reactive variable `x`:

```md
<!-- /src/App.vue -->

<script setup>
  import { ref } from 'vue'
  import { VSlider } from 'visualia'
  const x = ref(0)
  // Use x.value to access the slider value
</script>

<template>
  <v-slider v-model="x" />
</template>
```

#### See also

https://designstem.github.io/fachwerk/docs/#/f-slider
https://visualia.github.io/visualia_original/#live-variables_slider

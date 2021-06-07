# v-slider

Slider allows to set global numberic variables.

#### Usage

```md
<v-slider set="x" />

> The value of `x` is `{{ get("x") }}`
```

<v-slider set="x"  />

> The value of `x` is `{{ get('x') }}`

To use `x` value more creatively, you can use it to control the [circle element](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle) in SVG graphics:

```md
<svg width="400" height="40">
  <circle :cx="get('x')" cy="20" r="10" />
</svg>
```

<svg width="400" height="40">
  <circle :cx="get('x')" cy="20" r="10" />
</svg>

#### Setting properties

Since `<v-slider />` is a lightweight wrapper around `<input type="range">` so all the [HTML element properties](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range), including `min`, `max` and `step` also work.

```md
<v-slider set="x2" step="100" max="400" />
```

<v-slider set="x2" step="100" max="400"  />

> The value of `x2` is `{{ get('x2') }}`

<svg width="400" height="40">
  <circle :cx="get('x2')" cy="20" r="10" />
</svg>

#### Model usage

`<v-slider>` can also be used with a `v-model`:

```md
<!-- /src/App.vue -->

<script setup>
  import { ref } from 'vue'
  const x = ref(0)
  // Use x.value to access the slider value
</script>

<template>
  <v-slider v-model="x" >
</template>
```

#### See also

https://designstem.github.io/fachwerk/docs/#/f-slider
https://visualia.github.io/visualia_original/#live-variables_slider

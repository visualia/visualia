# v-slider

Slider sets global numeric variables.

#### Usage

```md
<v-slider set="x" />

> The value of x is {{ get("x") }}
```

<v-slider set="x"  />

> The value of x is {{ get('x') }}

To use slider-controlled `x` value in graphics, you can use it to control the SVG[<circle />](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle) element:

```md
<svg width="400" height="40">
  <circle :cx="get('x')" cy="20" r="10" />
</svg>
```

<svg width="400" height="40">
  <circle :cx="get('x')" cy="20" r="10" />
</svg>

#### Setting properties

v-slider accepts the following props:

```ts
const props =
  defineProps<{
    set?: string;
    value?: number;
    modelValue?: number;
  }>();
```

Since `<v-slider />` is a lightweight wrapper around `<input type="range">` so all the [HTML element properties](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range), including `min`, `max` and `step` also work.

```md
<v-slider set="x2" max="400" step="50" />
```

<v-slider set="x2" max="400" step="50" />

> The value of x2 is {{ get('x2') }}

<svg width="400" height="40">
  <circle :cx="get('x2')" cy="20" r="10" />
</svg>

Note that `step` propery allows to use `any` parameter that converts allows to use a floating point number as value for those _smoooth_ interactions.

```md
<v-slider set="x3" max="400" step="any" />
```

<v-slider set="x3" max="400" step="any" />

> The value of x3 is {{ get('x3') }}

<svg width="400" height="40">
  <circle :cx="get('x3')" cy="20" r="10" />
</svg>

#### Usage vith v-model

`<v-slider>` can also be used with a `v-model`:

```md
<!-- /src/App.vue -->

<script setup>
  import { ref } from 'vue'
  const x = ref(0)
  // Use x.value to access the slider value
</script>

<template>
  <v-slider v-model="x" />
</template>
```

#### Emits

```ts
const emit = defineEmit<(e: "update:modelValue", value: number) => number>();
```

#### See also

https://designstem.github.io/fachwerk/docs/#/f-slider
https://visualia.github.io/visualia_original/#live-variables_slider

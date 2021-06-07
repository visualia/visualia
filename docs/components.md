---
title: Components
---

# Components

## v-slider

Slider allows to change the global numeric value.

#### Usage

```vue
<v-slider set="x" />

> The value of `x` is `{{ get("x") }}`
```

<v-slider set="x"  />

> The value of `x` is `{{ get('x') }}`

To use the `x` value more creatively, you can use the value to control the [circle element](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle) in SVG graphics.

```vue
<svg width="400" height="40">
  <circle :cx="get('x')" cy="20" r="10" />
</svg>
```

<svg width="400" height="40">
  <circle :cx="get('x')" cy="20" r="10" />
</svg>

#### Setting properties

Since `<v-slider />` is a lightweight wrapper around `<input type="range">` so all the [HTML element properties](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range), including `min`, `max` and `step` also work.

```vue
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

## v-math

v-math displays mathematical expressions.

#### Usage

Here are some simple math expressions:

```vue
>
<v-math>a = 100 \\\\ b = \frac{a}{10} = 10</v-math>
```

> <v-math>a = 100 \\\\ b = \frac{a}{10} = 10</v-math>

<p />

#### Dynamic values

To use the dynamic values in expressions, get and set the global variables. Lets assign <v-math>a</v-math> to variable and use `<v-slider />` to control it.

```vue
<v-slider set="a" />

>
<v-math>a = {{ get("a") }} \\\\ \frac{ {{ get("a") }} }{10} = {{ get("a") / 10 }}</v-math>
```

<v-slider set="a" />

> <v-math>a = {{ get("a") }} \\\\ \frac{ {{ get("a") }} }{10} = {{ get("a") / 10 }}</v-math>

#### Syntax reference

Here are some references and examples how to express math in LaTeX / KaTeX format:

https://katex.org/docs/supported.html
https://en.wikibooks.org/wiki/LaTeX/Mathematics

#### See also

https://designstem.github.io/fachwerk/docs/#/f-math
https://visualia.github.io/visualia_original/#math

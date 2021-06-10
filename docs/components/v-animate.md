# v-animate

Animates global numeric variables.

Here are the props you can pass to the component:

`set`: Name of the global variable
`duration`: Animation duration in millisecons. By default it's `1000` milliseconds / `1` second.
`min` minimum value. `0` by default.
`max` maximum value to animate to. `100` by default.

#### Usage

```md
<v-animate set="x" :max="360" :duration="10 * 1000" />
> The value of x is {{ get("x") }}
```

<v-animate set="x" :max="360" :duration="10 * 1000" />
> The value of x is {{ get("x") }}

Because animation changes the global variable `x`, we can also use [v-slider](/components/v-slider) to refer to the same variable:

```md
<v-slider set="x" :max="360" step="any" />
```

<v-slider set="x" :max="360" step="any" />

You can use animated `x` value to control the SVG [circle](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle) element:

```md
<svg width="360" height="40">
  <circle :cx="get('x')" cy="20" r="10" />
</svg>
```

<svg width="360" height="40">
  <circle :cx="get('x')" cy="20" r="10" />
</svg>

Using the [pol2car](/utils/trig#pol2car) function it's possible to convert `x` value into circular motion:

```md
<svg width="360" height="360">
  <circle cx="180" cy="180" r="100" stroke="black" fill="none" /> 
  <circle
    :cx="pol2car(get('x',0),100).x + 180"
    :cy="pol2car(get('x',0),100).y + 180"
    r="10"
  />
</svg>
```

<svg width="360" height="360">
  <circle cx="180" cy="180" r="100" stroke="black" fill="none" /> 
  <circle
    :cx="pol2car(get('x',0),100).x + 180"
    :cy="pol2car(get('x',0),100).y + 180"
    r="10"
  />
</svg>

#### Usage vith v-model

`<v-animate>` can also be used with a `v-model`:

```md
<!-- /src/App.vue -->

<script setup>
  import { ref } from 'vue'
  const x = ref(0)
  // Use x.value to access the animated value
</script>

<template>
  <v-animate v-model="x" />
</template>
```

#### Props

```ts
const props =
  defineProps<{
    set?: string;
    duration?: number;
    min?: number;
    max?: number;
    value?: number;
    modelValue?: number;
  }>();
```

#### Emit

```ts
const emit = defineEmit<(e: "update:modelValue", value: number) => number>();
```

#### See also

https://designstem.github.io/fachwerk/docs/#/f-animate

https://visualia.github.io/visualia_original/#live-variables_animate

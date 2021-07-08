# Variables

Visualia allows to use a both **global** (shared between pages)and **local** (page-specific) variables. They cater to different use cases: global variables simpler to set up and can be shared between pages; local variables use longer syntax but allow more fine control over them.

## Global variables

#### Setting and getting a global variable

Let's use a button to set a global variable `v.x`:

```md
<button v-on:click="v.x = 100">Set v.x to 100</button>

> v.x is: {{ v.x }}
```

<button v-on:click="v.x = 100">Set v.x to 100</button>

> v.x is: {{ v.x }}

#### Getting a global variable with a default value

When global variable is not yet set, it's value is `undefined`:

```md
> v.y value is {{ v.y }}
> v.y type is {{ typeof v.y }}
```

> v.y value is {{ v.y }}
> v.y type is {{ typeof v.y }}

In some cases, you need to have a global value available before it is set. Your can use [?? operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_operator) to provide a default value:

```md
> v.y is {{ v.y ?? 0 }}
```

> v.y is {{ v.y ?? 0 }}

Let's use a button to set `v.y` to see how the values above change:

```md
<button v-on:click="v.y = 200">Set v.y to 200</button>
```

<button v-on:click="v.y = 200">Set v.y to 200</button>

<button v-on:click="v.y = undefined">Set v.y to undefined</button>

#### Getting all global variables

To get all global variables, you need just to output a `v` value:

```md
> {{ v }}
```

> {{ v }}

#### Global variables in custom components

You can also access global variables in your custom components by importing Visualia's global values object `v`:

```vue
<!-- /src/App.vue -->

<script setup>
import { watchEffect } from "vue";
import { v, VSlider } from "visualia";
watchEffect(() => console.log(v.x));
</script>

<template>
  <v-slider v-model="v.x" />
</template>
```

## Local variables

For local variables, we use two new components syntaxes introduced in Vue 3: [script setup](https://github.com/vuejs/rfcs/pull/227) and [ref sugar](https://github.com/vuejs/rfcs/pull/228).

First, we create a `<script setup>` section and set a local variable `x`.

```md
<script setup>
import { ref } from 'vue'
const x = ref(100)
</script>
```

<script setup>
import { ref } from 'vue'
const x = ref(100)
</script>

Next we use the variable `x` to control the SVG circle position in x-axis:

```md
<svg width="400" height="20">
  <circle :cx="x" cy="10" r="10" />
</svg>
```

<svg width="400" height="20">
  <circle :cx="x" :cy="10" r="10" />
</svg>

Now let's add a slider control to adjust the `x` value:

```md
<v-slider v-model="x" max="400" />
> {{ x }}
```

<v-slider v-model="x" max="400" />

> {{ x }}

::: warning Only one script setup
In the current implementation, Vitepress supports only one `<script setup>` section per page.
:::

#### Prior art

https://visualia.github.io/visualia_original/#live-variables

---
set:
  a: 10
---

{{ set('a.b', 10) }}
{{ get('a') }}

# Global variable functions

Visualia offers to pass global variables (simple key-value pairs) between all the parts of the app. This includes Visualia components and utilities, custom components, Markdown files, SVG elements and more.

## get

```ts
function get(
  key: string,
  def?: string | number | boolean
): string | number | boolean | null;
```

To get the variable from the global state, use the `get()` function.

```md
> x value is {{ get("x") }}
```

> x value is {{ get("x") }}

## set

```ts
function set(key: string, value: string | number | boolean | null);
```

To set the global state variable, use `set(key, value)` function:

```md
<button v-on:click="set('x', 100)">Set x to 100</button>
<button v-on:click="set('x', 0)">Set x to 0</button>
<button v-on:click="set('x', null)">Set x to null</button>
```

<button v-on:click="set('x',100)">Set x to 100</button>
<button v-on:click="set('x',0)">Set x to 0</button>
<button v-on:click="set('x',null)">Set x to null</button>

## Other

#### Getting and setting variables with Visualia components

There are also Visualia components that can set state with a `set` prop:

```md
<v-slider set="y" />

> y value is {{ get("y") }}
```

<v-slider set="y" />

> y value is {{ get('y') }}

#### Getting and setting variables with custom components

You can also access global variables in your custom components by importing Visualia's `get()` and `set()` functions.

```vue
<!-- /src/App.vue -->

<script setup>
  import { watchEffect } from 'vue'
  import { get } from 'visualia'

  watchEffect(() => console.log(get('x')))
</script>

<template>
  <v-slider set="x">
</template>
```

#### See also

https://visualia.github.io/visualia_original/#live-variables

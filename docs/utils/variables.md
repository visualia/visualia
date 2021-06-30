# Global variables

Visualia allows to use a shared global variables (simple key-value pairs) between all the parts of the app. This includes Visualia components and utilities, custom components, Markdown files and more.

#### Setting and getting a global variable

Let's use a button to set a global variable `v.x`:

```md
<button v-on:click="v.x = 100">Set v.x to 100</button>

> v.x is: {{ v.x }}
```

<button v-on:click="v.x = 100">Set v.x to 100</button>

> v.x is: {{ v.x }}

#### Getting global variable before it is set

When global variable is not yet set, it's value is `undefined`:

```md
> v.y value is {{ v.y }}
> v.y type is {{ typeof v.y }}
```

> v.y value is {{ v.y }}
> v.y type is {{ typeof v.y }}

In some cases you will need to set a default value before the global value is set. For this you can use a [?? operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_operator) to provide a default value:

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

To get all global variables, you will need just to display a `v` value:

```md
> {{ v }}
```

> {{ v }}

#### Usage in custom components

You can also access global variables in your custom components by importing Visualia's global values object `v`:

```vue
<!-- /src/App.vue -->

<script setup>
import { watchEffect } from "vue";
import { v } from "visualia";
watchEffect(() => console.log(v.x));
</script>

<template>
  <v-slider v-model="v.x" />
</template>
```

#### See also

https://visualia.github.io/visualia_original/#live-variables

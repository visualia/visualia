---
title: Components
---

# Components

## Slider

Slider allows to change the global numeric value.

```md
<v-slider set="x" />
```

<v-slider set="x" />

Slider value is {{ get('x') }}

Since `<v-slider />` is a lightweight wrapper around `<input type="range">` all the standard HTML props also work.

```md
<v-slider set="y" step="100" max="1000" />
```

<v-slider set="y" step="100" max="400" />

Slider value is {{ get('y') }}

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

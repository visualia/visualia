---
title: Getting started
---

# Getting started

## Vitepress

To use Visualia component and utility functions,
just import `Visualia` plugin and add it to the Vitepress app instance.

Also check out also the Visualia + Vitepress sample project: https://github.com/visualia/create-vitepress-visualia

```js
// /docs/.vitepress/theme/index.js

import DefaultTheme from "vitepress/theme";
import { Visualia } from "visualia";

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.use(Visualia);
  },
};
```

You can now use Visualia in any markdown file:

```vue
<v-math>x = {{ get("x") }}</v-math>
<v-slider set="x" />
```

The result:

<v-math>x = {{ get("x") }}</v-math>
<v-slider set="x" />

## Vue

For Vue usage, we recommend Vite. After completing [Vite installation](https://vitejs.dev/guide/#scaffolding-your-first-vite-project), import Visualia plugin and add it to the main Vue instance:

```js
// /src/main.js

import { createApp } from "vue";
import { Visualia } from "visualia";

import App from "./App.vue";

const app = createApp(App);
app.use(Visualia);
```

Now in Vue templates you can use Visualia components and utilities:

```vue
<!-- /src/App.vue -->

<template>
  <v-math>x = {{ get("x") }}</v-math>
  <v-slider set="x" />
</template>
```

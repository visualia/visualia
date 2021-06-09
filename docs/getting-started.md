# Getting started

## Vitepress

::: tip Starter project

Check out also the Visualia + Vitepress sample project: https://github.com/visualia/create-vitepress-visualia

:::

To use Visualia component and utility functions in Vitepress, first install Visualia npm package:

```sh
npm install visualia
```

Next, import `Visualia` plugin and add it to the Vitepress app instance.

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

You can now use Visualia in any Markdown file:

```md
<v-slider set="x" />
> x = {{ get("x") }}
```

The result:

<v-slider set="x" />
> x = {{ get("x") }}

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

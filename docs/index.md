---
title: Visualia
---

# Getting started

## Vitepress

To use Visualia component and utility functions,
just import `Visualia` plugin and add it to the Vitepress app instance.

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
<v-slider set="y" />

{{ get("y") }}
```

will result:

::: tip Result
The value of slider is: {{ get("x") }}
<v-slider set="x" />
:::

## Vue

For Vue usage, we recommend Vite. After completing [Vite installation](https://vitejs.dev/guide/#scaffolding-your-first-vite-project), import Visualia plugin and add it to the main Vue instance:

```js
// /src/main.js

import { createApp } from "vue";
import { Visualia } from "visualia";

import App from "./src/App.vue";

const app = createApp(App);
app.use(Visualia);
```

# Installation

## Vitepress

Since Visualia and [Vitepress](https://vitepress.vuejs.org/) are built on the same underlying technologies, it is easy to integrate them.

::: tip Starter project

Here's a Visualia + Vitepress starter project to quickly get going:
https://github.com/visualia/create-visualia-vitepress

:::

To use Visualia component and utility functions in Vitepress, first install Visualia npm package:

```
npm install visualia
```

Next, import `Visualia` plugin and add it to the Vitepress theme's app configuration:

```js
// /docs/.vitepress/theme/index.js

import DefaultTheme from "vitepress/theme";
import { Visualia } from "visualia";

import "visualia/dist/style.css";

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.use(Visualia);
  },
};
```

Also, set the following configuration for Vite:

```js
// /docs/vite.config.js

export default {
  optimizeDeps: { exclude: ["visualia"] },
};
```

You can now use Visualia in any Markdown file:

```md
<v-slider v-model="v.x" />

> x is {{ v.x }}
```

## sli.dev

[sli.dev](https://sli.dev/) is a presentation tool for devs has nice API to integrating with Visualia.

::: tip Starter project

Here's a Visualia + sli.dev starter project to quickly get going:

Demo: https://create-visualia-slidev.netlify.app/
Source: https://github.com/visualia/create-visualia-slidev

:::

To use Visualia component and utility functions in sli.dev, first install Visualia npm package:

```
npm install visualia@latest
```

Next, import the `Visualia` plugin and add it to the sli.dev app configuration.

```js
// /setup/main.js

import { defineAppSetup } from "@slidev/types";
import { Visualia } from "visualia";

import "visualia/dist/style.css";

export default defineAppSetup(({ app }) => {
  app.use(Visualia);
});
```

Also, you will need to add the css styles:

```html
<!-- /index.html -->
<head>
  <link href="https://unpkg.com/visualia/dist/style.css" rel="stylesheet" />
</head>
```

Now start editing `/slides.md`

```md
---
theme: default
layout: default
---

# Hello Visualia in sli.dev!

<v-slider v-model="v.x" />

> x is {{ v.x }}

---

# Hello Visualia in sli.dev!

<v-animate v-model="v.y" />

> y is {{ v.y }}
```

## Vite

For Vue usage, we recommend [Vite](https://vitejs.dev/) frontend tooling. After completing [Vite installation](https://vitejs.dev/guide/#scaffolding-your-first-vite-project), import the Visualia plugin and add it to the main Vue instance:

```js
// /src/main.js

import { createApp } from "vue";
import { Visualia } from "visualia";

import App from "./App.vue";

import "visualia/dist/style.css";

const app = createApp(App);
app.use(Visualia);
```

Now in Vue templates, you can use Visualia components and utilities:

```vue
<!-- /src/App.vue -->

<template>
  <v-slider set="v.x" />
  <blockquote>x is {{ v.x }}</blockquote>
</template>
```

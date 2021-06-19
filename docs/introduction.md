# Introduction

Let's start with a simple interactive example: let's have a slider that controls the movement of a circle in x axis.

#### First option

Using the default Vue / Vitepress format it would look like this:

```md
<script setup>
ref: x = 0
</script>

<input type="range" v-model.number="x" max="400" />

<svg width="400" height="40">
  <circle :cx="x" cy="20" r="2s0" />
</svg>

> {{ x }}
```

<script setup>
ref: x = 0
</script>

<input type="range" v-model.number="x" max="400" />

<svg width="400" height="40">
  <circle :cx="x" cy="20" r="20" />
</svg>

> {{ x }}

#### Second option

Great, but can we simpilfy this? Out input slider feels a bit lengthy and requires intimate knowledge of HTML input elements and Vue model bindings.

Let's use a component provided by Visualia, `<v-slider />`. It is a lightweight wrapper around the range input element. Visualia components are auto-loaded with `app.use(Visualia)` plugin, so we can use it right away.

```md
<script setup>
ref: x = 100
</script>

<v-slider v-model="x" max="400" />

<svg width="400" height="40">
  <circle :cx="x" cy="20" r="20" />
</svg>

> {{ x }}
```

<v-slider v-model="x" max="400" />

<svg width="400" height="40">
  <circle :cx="x" cy="20" r="20" />
</svg>

> {{ x }}

#### Third option

Can we simplify this even more? `<script setup>` is very powerful way to have Javascript / Typescript code in the Markdown but when we just need to define a reactive variable `x` it seems a little too verbose.

Here's the trick: Visualia allows to use a reactive object `ref` in templates for getting a setting values.

```md
<v-slider v-model="ref.x" max="400" />

<svg width="400" height="40">
  <circle :cx="ref.x" cy="20" r="20" />
</svg>

> {{ ref.x }}
```

<v-slider v-model="ref.x" max="400" />

<svg width="400" height="40">
  <circle :cx="ref.x" cy="20" r="20" />
</svg>

> {{ ref.x }}

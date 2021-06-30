# Introduction

Let's start with a simple interactive example: let's have a slider that controls the movement of a circle in x axis.

#### Initial version

Using the default Vue / Vitepress format it would look like this:

```md
<script setup>
  import { ref } from "vue";
  const x = ref(0);
</script>

<svg width="400" height="20">
  <circle :cx="x" cy="10" r="10" />
</svg>

<input type="range" v-model.number="x" max="400" />

> {{ x }}
```

<script setup>
  import { ref } from "vue";
  const x = ref(0);
</script>

<svg width="400" height="20">
  <circle :cx="x" cy="10" r="10" />
</svg>

<input type="range" v-model.number="x" max="400" />

> {{ x }}

#### Adding ref sugar

We can simplify the setup part by using the experimental [ref sugar syntax](https://github.com/vuejs/rfcs/pull/228).

```md{2}
<script setup>
  ref: x = 0
</script>

<svg width="400" height="20">
  <circle :cx="x" cy="10" r="2s0" />
</svg>

<input type="range" v-model.number="x" max="400" />

> {{ x }}
```

<svg width="400" height="20">
  <circle :cx="x" cy="10" r="10" />
</svg>

<input type="range" v-model.number="x" max="400" />

> {{ x }}

#### Slider component

Great, but can we simplify this even more? Out input slider feels a bit lengthy and requires intimate knowledge of HTML input elements and Vue model bindings.

Let's use a component provided by Visualia, `<v-slider />`. It is a lightweight wrapper around the range input element. Visualia components are auto-loaded with `app.use(Visualia)` plugin, so we can use it right away.

```md{9}
<script setup>
ref: x = 100
</script>

<svg width="400" height="20">
  <circle :cx="x" cy="10" r="10" />
</svg>

<v-slider v-model="x" max="400" />

> {{ x }}
```

<svg width="400" height="20">
  <circle :cx="x" cy="10" r="10" />
</svg>

<v-slider v-model="x" max="400" />

> {{ x }}

#### Global variables

Can we simplify this even more? `<script setup>` is very powerful way to have Javascript / Typescript code in the Markdown but when we just need to define a reactive variable `x` it seems a little too verbose.

Here's the trick: Visualia allows to use reactive object `v.` for getting and setting global values.

```md{2,5}
<svg width="400" height="20">
  <circle :cx="v.x" cy="10" r="10" />
</svg>

<v-slider v-model="v.x" max="400" />

> v.x is {{ v.x }}
```

<svg width="400" height="20">
  <circle :cx="v.x" cy="10" r="10" />
</svg>

<v-slider v-model="v.x" max="400" />

> v.x is {{ v.x }}

#### Adding multiple circles

Now do something more interesting with a moving dot, or even better, _moving dots_.

We can use Vue `v-for` directive to create multiple circles:

```md{3-4}
<svg width="400" height="20">
  <circle
    v-for="a in 10"
    :cx="x + a * 20"
    cy="10"
    r="10"
  />
</svg>
```

<svg width="400" height="20">
  <circle
    v-for="a in 10"
    :cx="x + a * 20"
    cy="10"
    r="10"
  />
</svg>

<v-slider v-model="x" max="400" />

#### Bring in color

Let's bring in some color! Let's use a `hsl()` function to control the color of the circles:

```md{7}
<svg width="400" height="20">
  <circle
    v-for="a in 10"
    :cx="x + a * 20"
    cy="10"
    :fill="hsl(a * 36,100,50)"
    r="10"
  />
</svg>
```

<svg width="400" height="20">
  <circle
    v-for="a in 10"
    :cx="x + a * 20"
    cy="10"
    :fill="hsl(a * 36,100,50)"
    r="10"
  />
</svg>

<v-slider v-model="x" max="400" />

#### Adding more movement

Finally, get some lifelike movement here. Buy using Javascript's `Math.sin()` and some experimentation with coordinates we end up here:

```md{5}
<svg width="400" height="40">
  <circle
    v-for="a in 10"
    :cx="x + a * 20"
    :cy="Math.sin(a + x / 20) * 10 + 20"
    :fill="hue(a * 36)"
    r="10"
  />
</svg>
```

<svg width="400" height="40">
  <circle
    v-for="a in 10"
    :cx="x + a * 20"
    :cy="Math.sin(a + x / 20) * 10 + 20"
    :fill="hue(a * 36)"
    r="10"
  />
</svg>

<v-slider v-model="x" max="400" />

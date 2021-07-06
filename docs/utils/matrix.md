# matrix

All the SVG [transforms](/utils/transforms) are based on the `matrix()` function. It applies transformation matrix to an element:

<v-math>\begin{pmatrix} a & c & e \\ b & d & f \\ 0 & 0 & 1 \end{pmatrix}</v-math>

<p />

#### Function signature

```ts
function matrix(
  a: number = 1, // scaleX
  b: number = 0, // skewY
  c: number = 0, // skewX
  d: number = 1, // scaleY
  e: number = 0, // translateX
  f: number = 0 // translateY
): string;
```

#### Usage

Let's set up a local variable `m` as an object with default matrix values `a, b, ...` and create a SVG rectangle that we transform with a `matrix()` function:

```md
<script setup>
  ref: m = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0
  }
</script>

> <v-slider v-model="m.a" min="-4" max="4" step="any" />

> a / scaleX:
> {{ m.a }}

<!-- ...other matrix parameters... -->

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect transform-origin="200 200" x="150" y="150" width="100" height="100" fill="red" opacity="0.5"
    :transform="matrix(m.a,m.b,m.c,m.d,m.e,m.f)"
  />
</svg>
```

<script setup>
  import { ref } from 'vue'
  const defaultM = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0
  }
  const m = ref({...defaultM})
</script>

<div class="grid">

<div>

> <v-slider v-model="m.a" min="-4" max="4" step="any" />
> a / scaleX:
> {{ m.a }}

> <v-slider v-model="m.b" :value="0" max="360" step="any" />
> b / scewY:
> {{ m.b }}

> <v-slider v-model="m.c" :value="0" max="360" step="any" />
> c / scewX:
> {{ m.c }}

> <v-slider v-model="m.d" :value="1" min="-4" max="4" step="any" />
> d / ScaleY:
> {{ m.d }}

> <v-slider v-model="m.e" :value="0" min="-100" />
> e / translateX:
> {{ m.e }}

> <v-slider v-model="m.f" :value="0" min="-100"/>
> f / translateY:
> {{ m.f }}

<button v-on:click="m = {...defaultM}">Reset matrix values</button>

</div>

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect transform-origin="200 200" x="150" y="150" width="100" height="100" fill="red" opacity="0.5"
    :transform="matrix(m.a,m.b,m.c,m.d,m.e,m.f)"
  />
</svg>

</div>

#### See more

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#matrix

https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix()

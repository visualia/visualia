# Transforms

Transform functions, `translate()`, `rotate()`, `scale()`, `skewX()`, `skewX()` and `matrix()` help to pass numeric values to SVG [transform attribute](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform).

## translate

Translate moves object by `x` and `y`.

#### Function signature

```ts
function translate(x: number = 0, y: number = 0): string;
```

#### Usage

```md
<svg width="400" height="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect transform-origin="200 200" x="150" y="150" width="100" height="100" fill="red" opacity="0.5"
    :transform="translate(v.x, v.y)"
  />
</svg>

> <v-slider v-model="v.x" :value="0" min="-100" />
> v.x / translateX: {{ v.x }}

> <v-slider v-model="v.y" :value="0" min="-100"/>
> v.y / translateY: {{ v.y }}
```

<svg width="400" height="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect transform-origin="200 200" x="150" y="150" width="100" height="100" fill="red" opacity="0.5"
    :transform="translate(v.x, v.y)"
  />
</svg>

> <v-slider v-model="v.x" :value="0" min="-100" />
> v.x / translateX: {{ v.x }}

> <v-slider v-model="v.y" :value="0" min="-100"/>
> v.y / translateY: {{ v.y }}

## rotate

Rotates object by `angle` degrees around the point with `x` and `y` coordinates.

#### Function signature

```ts
function rotate(angle: number = 0, x?: number, y?: number): string;
```

#### Usage

> <v-slider v-model="v.angle" max="360" step="any" />
> angle: {{ v.angle }}

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="rotate(v.angle)"
  transform-origin="200 200"
  />
</svg>

#### See also

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#rotate

## scale

#### Function signature

```ts
function scale(scaleX: number = 1, scaleY?: number): string;
```

#### Usage

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="scale(v.scaleX, v.scaleY)" transform-origin="200 200"
  />
</svg>

> <v-slider v-model="v.scaleX" :value="1" min="-4" max="4" step="any" />
> scaleX: {{ v.scaleX }}

> <v-slider v-model="v.scaleY" :value="1" min="-4" max="4" step="any" />
> scaleY: {{ v.scaleY }}

#### See also

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#scale

## skewX

Transforms object along the x axis by `angle` degrees.

#### Function signature

```ts
function skewX(angle: number = 0): string;
```

#### Usage

> <v-slider v-model="v.scewXAngle" max="360" step="any" />
> angle: {{ v.scewXAngle }}

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="skewX(v.scewXAngle)" transform-origin="200 200"
  />
</svg>

#### See also

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#skewx

## skewY

Transforms object along the y axis by `angle` degrees.

#### Function signature

```ts
function skewY(angle: number = 0): string;
```

#### Usage

> <v-slider v-model="v.skewYAngle" max="360" step="any" />
> angle: {{ v.skewYAngle }}

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="skewY(v.skewYAngle)" transform-origin="200 200"
  />
</svg>

#### See also

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#skewy

## matrix

All the transformation above are based on the `matrix()` function. It applies transformation matrix to an element:

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

```md
<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="gray" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" 
    :transform="matrix(get('a',1),get('b',0),get('c',0),get('d',1),get('e',0),get('f',0))"
    transform-origin="200 200"
  />
</svg>
```

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

> <v-slider v-model="m.b" max="360" step="any" />
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

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect transform-origin="200 200" x="150" y="150" width="100" height="100" fill="red" opacity="0.5"
    :transform="matrix(m.a,m.b,m.c,m.d,m.e,m.f)"
  />
</svg>

#### See more

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#matrix

https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix()

## Combining transforms

You can also combine transform functions by adding them to the array and join them into string:

```md
<rect :transform="[translate(get('x'), 0), rotate(get('angle'))].join(' ')" />
```

> <v-slider set="x" :value="0" min="-100" />
> translateX: {{ get('x') }}

> <v-slider set="angle" max="360" step="any" />
> angle: {{ get('angle') }}

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="[translate(get('x'), 0), rotate(get('angle'))].join(' ')" transform-origin="200 200"/>
</svg>

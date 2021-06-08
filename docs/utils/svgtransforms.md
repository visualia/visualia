# Transforms

Transform functions, `translate()`, `rotate()`, `scale()`, `skewX()`, `skewX()` and `matrix()` help to pass numeric values to SVG [transform attribute](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform).

## translate

Translate moves object by `x` and `y`.

#### Function signature

```ts
export function translate(x: number | null, y: number | null): string;
```

#### Usage

```md
<svg height="400" width="400" class="shadow">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect transform-origin="200 200" x="150" y="150" width="100" height="100" fill="red" opacity="0.5"
    :transform="translate(get('x'), get('y'))"
  />
</svg>
```

> <v-slider set="x" :value="0" min="-100" />
> x / translateX: {{ get('x') }}

> <v-slider set="y" :value="0" min="-100"/>
> y / translateY: {{ get('y') }}

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect transform-origin="200 200" x="150" y="150" width="100" height="100" fill="red" opacity="0.5"
    :transform="translate(get('x'), get('y'))"
  />
</svg>

## rotate

Rotates object by `angle` degrees.

#### Function signature

```ts
function rotate(angle: number): string;
```

#### Usage

> <v-slider set="angle" max="360" step="any" />
> angle: {{ get('angle') }}

<!-- <svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="rotate(get('angle'))"
  transform-origin="200 200"
  />
</svg> -->

## scale

#### Function signature

```ts
function scale(scaleX: number, scaleY: string): string;
```

#### Usage

> <v-slider set="scaleX" :value="1" min="-4" max="4" step="any" />
> scaleX: {{ get('scaleX') }}

> <v-slider set="scaleY" :value="1" min="-4" max="4" step="any" />
> scaleX: {{ get('scaleY') }}

<!-- <svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="scale(get('scaleX'), get('scaleY'))" transform-origin="200 200"
  />
</svg> -->

## skewX

Transforms object along the x axis by `angle` degrees.

#### Function signature

```ts
function skewX(angle: number): string;
```

#### Usage

> <v-slider set="scewXAngle" max="360" step="any" />
> angle: {{ get('scewXAngle') }}

<!--
<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="skewX(get('scewXAngle', 0))" transform-origin="200 200"
  />
</svg> -->

## skewY

Transforms object along the y axis by `angle` degrees.

#### Function signature

```ts
function skewY(angle: number): string;
```

#### Usage

> <v-slider set="skewYAngle" max="360" step="any" />
> angle: {{ get('skewYAngle') }}

<!-- <svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="skewY(get('skewYAngle', 0))" transform-origin="200 200"
  />
</svg> -->

## Combining transforms

You can also combine transform functions by adding them to the array:

```md
<rect :transform="[translate(get('x'), 0), rotate(get('angle'))].join(' ')" />
```

> <v-slider set="x" :value="0" min="-100" />
> x / translateX: {{ get('x') }}

> <v-slider set="angle" max="360" step="any" />
> angle: {{ get('angle') }}

<!-- <svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
</svg> -->

## matrix

Applies transformation matrix to an element

<v-math>\begin{pmatrix} a & c & e \\ b & d & f \\ 0 & 0 & 1 \end{pmatrix}</v-math>

The values represent the following functions:

```
matrix( scaleX(), skewY(), skewX(), scaleY(), translateX(), translateY())
```

#### Function signature

```ts
function matrix(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number
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

<div style="display: grid; grid-template-columns: 1fr auto">

<div>

> <v-slider set="a" :value="1" min="-4" max="4" step="any" />
> a / scaleX:
> {{ get('a') }}

> <v-slider set="b" :value="0" max="360" step="any" />
> b / scewY:
> {{ get('b') }}

> <v-slider set="c" :value="0" max="360" step="any" />
> c / scewX:
> {{ get('c') }}

> <v-slider set="d" :value="1" min="-4" max="4" step="any" />
> d / ScaleY:
> {{ get('d') }}

> <v-slider set="e" :value="0" min="-100" />
> e / translateX:
> {{ get('e') }}

> <v-slider set="f" :value="0" min="-100"/>
> f / translateY:
> {{ get('f') }}

<button v-on:click="() => { set('a',1); set('b',0); set('c', 0); set('d', 1); set('e', 0); set('f', 0); }">Reset</button>

</div>

<!-- <svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect transform-origin="200 200" x="150" y="150" width="100" height="100" fill="red" opacity="0.5"
    :transform="matrix(get('a',1),get('b',0),get('c',0),get('d',1),get('e',0),get('f',0))"
  />
</svg> -->

</div>

#### See more

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#matrix

https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix()

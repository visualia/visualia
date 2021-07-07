# Transforms

Transform functions, `translate()`, `rotate()`, `scale()`, `skewX()`, `skewX()` and `matrix()` help to pass numeric values to SVG [transform attribute](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform).

## translate

Translate moves object by `x` and `y`.

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

```ts
function rotate(angle: number = 0, x?: number, y?: number): string;
```

#### Usage

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="rotate(v.angle)"
  transform-origin="200 200"
  />
</svg>

> <v-slider v-model="v.angle" max="360" step="any" />
> angle: {{ v.angle ?? 0 }}

#### Prior art

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#rotate

## scale

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
> scaleX: {{ v.scaleX ?? 1 }}

> <v-slider v-model="v.scaleY" :value="1" min="-4" max="4" step="any" />
> scaleY: {{ v.scaleY ?? 1}}

#### Prior art

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#scale

## skewX

Transforms object along the x axis by `angle` degrees.

#### Function signature

```ts
function skewX(angle: number = 0): string;
```

#### Usage

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="skewX(v.scewXAngle)" transform-origin="200 200"
  />
</svg>

> <v-slider v-model="v.scewXAngle" max="360" step="any" />
> angle: {{ v.scewXAngle ?? 0 }}

#### Prior art

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#skewx

## skewY

Transforms object along the y axis by `angle` degrees.

#### Function signature

```ts
function skewY(angle: number = 0): string;
```

#### Usage

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="skewY(v.skewYAngle)" transform-origin="200 200"
  />
</svg>

> <v-slider v-model="v.skewYAngle" max="360" step="any" />
> angle: {{ v.skewYAngle ?? 0 }}

#### Prior art

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform#skewy

## Combining transforms

You can also combine transform functions by adding them to the array and join them into string:

`[transformation, transformation, ...].join(' ')`

Here is an example:

```md
<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="[translate(v.x, 0), rotate(v.angle)].join(' ')" transform-origin="200 200"/>
</svg>

> <v-slider v-model="v.x" :value="0" min="-100" />
> v.translateX: {{ v.x ?? 0 }}

> <v-slider v-model="v.angle" max="360" step="any" />
> v.angle: {{ v.angle ?? 0 }}
```

<svg height="400" width="400">
  <rect x="150" y="150" width="100" height="100" fill="black" />
  <rect x="150" y="150" width="100" height="100" fill="red" opacity="0.5" :transform="[translate(v.x, 0), rotate(v.angle)].join(' ')" transform-origin="200 200"/>
</svg>

> <v-slider v-model="v.x" :value="0" min="-100" />
> v.translateX: {{ v.x ?? 0 }}

> <v-slider v-model="v.angle" max="360" step="any" />
> v.angle: {{ v.angle ?? 0 }}

# SVG utilities functions

Visualia provides a set of functions that help working with SVG graphics.

## arc

Draws an arc as SVG [path element](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths).

#### Function signature

```ts
function arc(startAngle: number, endAngle: number, radius: number): string;
```

#### Usage

```md
<v-slider set="endAngle" :value="180" :max="360" step="any" />

> endAngle: {{ get('endAngle') }}

<svg width="400" height="400">
  <g transform="translate(200,200)">
    <path :d="arc(0,get('endAngle'),100)" stroke="red" fill="none" />
  </g>
</svg>
```

<v-slider set="endAngle" :value="180" :max="360" step="any" />

> endAngle: {{ get('endAngle') }}

<svg width="400" height="400">
  <g transform="translate(200,200)">
    <path :d="arc(0,get('endAngle'),100)" stroke="red" fill="none" />
  </g>
</svg>

#### See also

https://designstem.github.io/fachwerk/docs/#/f-arc

## Transforms <mark>TODO</mark>

Transform functions, `translate()`, `rotate()` and `scale()` help to pass numeric values to SVG [transform attribute](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform).

#### Function signatures

```ts
function translate(x: number, y: number): string;
function rotate(angle: number): string;
function scale(scaleX: number, scaleY: string): string;
function skewX(angle: number): string;
function skewY(angle: number): string;
function skewX(angle: number): string {
function matrix(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number
): string
```

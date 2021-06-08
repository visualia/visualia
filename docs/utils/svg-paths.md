# SVG paths

Visualia provides a set of functions that help to generate SVG graphics.

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

# SVG utilities functions

Visualia provides a set of functions that help working with SVG graphics.

## arc

#### Function signature

```ts
function arc(startAngle: number, endAngle: number, radius: number): string;
```

#### Usage

<v-slider set="endAngle" :max="360 - 1" />

> endAngle: {{ get('endAngle') }}

<svg width="400" height="400">
  <g transform="translate(200,200)">
    <path :d="arc(0,get('endAngle'),100)" stroke="red" fill="none" />
  </g>
</svg>

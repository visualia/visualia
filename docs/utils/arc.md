# arc

Draws an arc as SVG [path element](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths).

#### Function signature

```ts
function arc(startAngle: number, endAngle: number, radius: number): string;
```

#### Usage

```md
<svg width="400" height="400">
  <g transform="translate(200,200)">
    <path :d="arc(0,v,endAngle ?? 150,150)" stroke="red" fill="none" />
  </g>
</svg>

<v-slider v-model="v.endAngle" :value="180" :max="360" step="any" />

> endAngle: {{ v.endAngle }}
```

<svg width="400" height="400">
  <g transform="translate(200,200)">
    <path :d="arc(0,v.endAngle ?? 150,150)" stroke="red" fill="none" />
  </g>
</svg>

<v-slider v-model="v.endAngle" :value="180" :max="360" step="any" />

> endAngle: {{ v.endAngle }}

#### See also

https://designstem.github.io/fachwerk/docs/#/f-arc

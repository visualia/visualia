# arc

Draws an arc as SVG [path element](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths).

```ts
function arc(startAngle: number, endAngle: number, radius: number): string;
```

#### Usage

Let's create an arc with `startAngle = 0`, `endAngle = v.endAngle` and `radius = 150`:

```md{3}
<svg width="400" height="400">
  <g transform="translate(200,200)">
    <path :d="arc(0,v.endAngle ?? 180,150)" stroke="red" fill="none" />
  </g>
</svg>

<v-slider v-model="v.endAngle" :max="360" step="any" />

> endAngle: {{ v.endAngle ?? 180 }}
```

<svg width="400" height="400">
  <g transform="translate(200,200)">
    <path :d="arc(0,v.endAngle ?? 180,150)" stroke="red" fill="none" />
  </g>
</svg>

<v-slider v-model="v.endAngle" :max="360" step="any" />

> endAngle: {{ v.endAngle ?? 180 }}

#### See also

https://designstem.github.io/fachwerk/docs/#/f-arc

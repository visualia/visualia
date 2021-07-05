# arcpath

Generates arc as a SVG [path](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths).

```ts
function arcpath(startAngle: number, endAngle: number, radius: number): string;
```

#### Usage

Let's create an arc with `startAngle = 0`, `endAngle = v.endAngle` and `radius = 150`:

```md{3}
<svg width="200" height="200">
  <g transform="translate(100,100)">
    <path :d="arcpath(0,v.endAngle ?? 180,100)" stroke="red" fill="none" />
  </g>
</svg>

<v-slider v-model="v.endAngle" :value="180" :max="360" step="any" />

> endAngle: {{ v.endAngle ?? 180 }}
```

<svg width="200" height="200">
  <g transform="translate(100,100)">
    <path :d="arcpath(0,v.endAngle ?? 180,100)" stroke="red" fill="none" />
  </g>
</svg>

<v-slider v-model="v.endAngle" :value="180" :max="360" step="any" />

> endAngle: {{ v.endAngle ?? 180 }}

#### See also

https://designstem.github.io/fachwerk/docs/#/f-arc

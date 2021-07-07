# arcpath

Generates arc as a SVG [path](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths).

```ts
function arcpath(startAngle: number, endAngle: number, radius: number): string;
```

#### Usage

Here is the playground to see the various `arcpath()` parameters.

```md
> <v-slider v-model="v.startAngle" :value="0" :max="360" step="any" />
> v.startAngle: {{ v.startAngle ?? 0 }}

> <v-slider v-model="v.endAngle" :value="180" :max="360" step="any" />
> v.endAngle: {{ v.endAngle ?? 180 }}

> <v-slider v-model="v.innerRadius" :value="25" />
> v.innerRadius: {{ v.innerRadius ?? 40 }}

> <v-slider v-model="v.outerRadius" :value="75" />
> v.outerRadius: {{ v.outerRadius ?? 50 }}

> <v-slider v-model="v.cornerRadius" :value="0" :max="20" />
> v.cornerRadius: {{ v.cornerRadius ?? 0 }}

<svg width="200" height="200">
  <g transform="translate(100,100)">
    <path :d="arcpath(
      v.startAngle ?? 0,
      v.endAngle ?? 180,
      v.innerRadius ?? 25,
      v.outerRadius ?? 75,
      v.cornerRadius ?? 0
    )" stroke="red" fill="none" />
  </g>
</svg>
```

<div class="grid">

<div>

> <v-slider v-model="v.startAngle" :value="0" :max="360" step="any" />
> v.startAngle: {{ v.startAngle ?? 0 }}

> <v-slider v-model="v.endAngle" :value="180" :max="360" step="any" />
> v.endAngle: {{ v.endAngle ?? 180 }}

> <v-slider v-model="v.innerRadius" :value="25" />
> v.innerRadius: {{ v.innerRadius ?? 40 }}

> <v-slider v-model="v.outerRadius" :value="75" />
> v.outerRadius: {{ v.outerRadius ?? 50 }}

> <v-slider v-model="v.cornerRadius" :value="0" :max="20" />
> v.cornerRadius: {{ v.cornerRadius ?? 0 }}

</div>

<svg width="200" height="200">
  <g transform="translate(100,100)">
    <path :d="arcpath(
      v.startAngle ?? 0,
      v.endAngle ?? 180,
      v.innerRadius ?? 25,
      v.outerRadius ?? 75,
      v.cornerRadius ?? 0
    )" stroke="red" fill="none" />
  </g>
</svg>

</div>

#### Prior art

https://designstem.github.io/fachwerk/docs/#/f-arc

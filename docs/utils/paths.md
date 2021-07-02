# Paths

## arcpath

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

## linepath

Creates connected lines based on array of point coordinates as a SVG path element.

```ts
function linepath(
  points: {
    x: number;
    y: number;
  }[],
  closed: boolean = false
): string;
```

#### Usage

```
> {{ linepath([{x: 0, y: 0}, {x: 10, y: 10}])}}
```

> {{ linepath([{x: 0, y: 0}, {x: 10, y: 10}])}}

#### Example

Let's use `polargrid()` function to generate the points along the circle and use `linepath()` to output them as a path. Grid items count is controlled by global variable `v.count`:

```md
<svg width="200" height="200">
    <circle cx="100" cy="100" :r="100 - 1" stroke="#aaa" fill="none" />
    <path
      :d="linepath(polargrid(v.count ?? 3,100,closed = true))"
      fill="red"
      transform="translate(100,100)"
    />
</svg>

<v-slider v-model="v.count" :value="3" max="32" />

> v.count: {{ v.count }}
```

<svg width="200" height="200">
    <circle cx="100" cy="100" :r="100 - 1" stroke="#aaa" fill="none" />
    <path
      :d="linepath(polargrid(v.count ?? 3,100,closed = true))"
      fill="red"
      transform="translate(100,100)"
    />
</svg>

<v-slider v-model="v.count" :value="3" max="32" />

> v.count: {{ v.count }}

#### See also

https://designstem.github.io/fachwerk/docs/#/f-polygon

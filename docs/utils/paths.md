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

Creates connected lines as a SVG path element. Accepts an array of `{ x, y }` coordinates.

```ts
function linepath(
  coords: {
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

#### Example I

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
    :d="linepath(polargrid(v.count ?? 3,100),true)"
    stroke="red"
    fill="none"
    transform="translate(100,100)"
  />
</svg>

<v-slider v-model="v.count" :value="3" max="32" />

> v.count: {{ v.count }}

#### Example II

Combining grid and path functions can create insightful results, here we visualizing the drawing order of the `rectgrid()` function:

```md
<svg width="200" height="200">
  <g transform="translate(5,5)">
    <circle
      v-for="g in rectgrid(10,10,20)"
      :cx="g.x"
      :cy="g.y"
      r="4"
      fill="#eee"
    />
    <path
      :d="linepath(rectgrid(10,10,20))"
      stroke="red"
      fill="none"
    />
  </g>
</svg>
```

<svg width="200" height="200">
  <g transform="translate(5,5)">
    <circle
      v-for="g in rectgrid(10,10,20)"
      :cx="g.x"
      :cy="g.y"
      r="4"
      fill="#eee"
    />
    <path
      :d="linepath(rectgrid(10,10,20))"
      stroke="red"
      fill="none"
    />
  </g>
</svg>

#### See also

https://designstem.github.io/fachwerk/docs/#/f-polygon

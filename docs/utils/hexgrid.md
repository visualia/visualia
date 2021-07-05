# hexgrid

Generates a hexagonal grid. Returns `x y` coordinates for each grid item plus corresponding `col`, `row` and item `index`.

```ts
function hexgrid(
  countX: number,
  countY: number,
  step: number = 1,
  outer: boolean = false
): {
  x: number;
  y: number;
  col: number;
  row: number;
  index: number;
};
```

#### Usage

First, let's generate a `6 * 6` hexagonal grid with a step of `50`. We indicate grid item coordinates with small circles:

```md
<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
</svg>
```

<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
</svg>

Next, let's draw some hexagons, we will use [hexagonpath()](utils/paths/#hexagonpath) function for this:

```md{10}
<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50)"
    :d="hexagonpath(25)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
</svg>
```

<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50)"
    :d="hexagonpath(25)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
</svg>

Now let's draw a circle on top of the each hexagon, that has the same radius as the hexagon, `25`:

```md{20}
<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50)"
    :d="hexagonpath(25)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50)"
    :cx="g.x"
    :cy="g.y"
    r="25"
    stroke="#aaa"
    fill="none"
  />
</svg>
```

<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50)"
    :d="hexagonpath(25)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50)"
    :cx="g.x"
    :cy="g.y"
    r="25"
    stroke="#aaa"
    fill="none"
  />
</svg>

There is also an boolean option `outer` in `hexgrid()` that indicates whenever the hexagonal grid is construced using [circumscribed circle](https://en.wikipedia.org/wiki/Circumscribed_circle) aka **inner radius** (`outer = false`, a default option) or [inscribed circle](https://en.wikipedia.org/wiki/Inscribed_figure) aka **outer radius** (`outer = true`)

Let's use the latest example but add `outer = true` to `hexgrid()`:

```md{3,10,17}
<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50,outer = true)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50,outer = true)"
    :d="hexagonpath(25)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,outer = true)"
    :cx="g.x"
    :cy="g.y"
    r="25"
    stroke="#aaa"
    fill="none"
  />
</svg>
```

<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50,outer = true)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50,outer = true)"
    :d="hexagonpath(25)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,outer = true)"
    :cx="g.x"
    :cy="g.y"
    r="25"
    stroke="#aaa"
    fill="none"
  />
</svg>

Great but notice that the hexagons do not "fit" to this new grid. We also need to add `outer = true` to `hexagonpath()` function:

```md{11}
<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50,outer = true)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50,outer = true)"
    :d="hexagonpath(25,outer = true)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,outer = true)"
    :cx="g.x"
    :cy="g.y"
    r="25"
    stroke="#aaa"
    fill="none"
  />
</svg>
```

<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50,outer = true)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50,outer = true)"
    :d="hexagonpath(25,outer = true)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,outer = true)"
    :cx="g.x"
    :cy="g.y"
    r="25"
    stroke="#aaa"
    fill="none"
  />
</svg>

Here's the interactive example showing off inner and outer construction of the hexagon grid:

<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50,v.outer)"
    :cx="g.x"
    :cy="g.y"
    :r="25"
    stroke="black"
    :fill="[14,15,21].includes(g.index) ? 'rgba(255,0,0,0.5)' : 'none'"
    opacity="0.25"
  />
  <circle
    v-for="g in hexgrid(6,6,50,v.outer)"
    v-show="[14,15,21].includes(g.index)"
    :cx="g.x"
    :cy="g.y"
    :r="50"
    stroke="red"
    fill="none"
  />
  <path
    v-for="g in hexgrid(6,6,50,v.outer)"
    :transform="translate(g.x,g.y)"
    :d="hexagonpath(25,v.outer)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,v.outer)"
    :cx="g.x"
    :cy="g.y"
    :r="1"
  />
</svg>

> step = 50
> <button v-on:click="v.outer = !v.outer">outer = {{ v.outer ?? false }}</button>

#### Example

Finally, no hexagon tutorial would be complete without arab-esque tiling patterns:

```md
<svg width="400" height="400">
  <g transform="translate(-25,-25)">
  <path
    v-for="g in hexgrid(16,16,50,v.outer1)"
    :d="hexagonpath(50,v.outer2)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="royalblue"
    style="mix-blend-mode: multiply"
  />
  <circle
    v-for="g in hexgrid(16,16,50,v.outer3)"
    :cx="g.x"
    :cy="g.y"
    :r="50"
    stroke="white"
    fill="none"
    opacity="0.25"
  />
  </g>
</svg>

<button v-on:click="v.outer1 = !v.outer1">v.outer1 = {{ v.outer1 ?? false }}</button> <button v-on:click="v.outer2 = !v.outer2">v.outer2 = {{ v.outer2 ?? false }}</button> <button v-on:click="v.outer3 = !v.outer3">v.outer3 = {{ v.outer3 ?? false }}</button>
```

<v-slider v-model="v.r" :value="50" max="50" step="any" />

<v-slider v-model="v.r2" :value="50" step="any" />

<svg width="200" height="200">
  <g transform="translate(-50,-50)">
  <path
    v-for="g in hexgrid(8,8,50)"
    :d="hexagonpath(v.r)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="royalblue"
    style="mix-blend-mode: multiply"
  />
  <circle
    v-for="g in hexgrid(8,8,50)"
    :cx="g.x"
    :cy="g.y"
    :r="v.r2"
    stroke="white"
    fill="none"
    opacity="0.25"
  />
  </g>
</svg>

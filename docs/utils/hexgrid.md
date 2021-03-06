# hexgrid

`hexgrid()` generates a hexagonal grid. Returns `x y` coordinates for each grid item plus corresponding `col`, `row`, and item `index`.

```ts
function hexgrid(
  countX: number,
  countY: number,
  step: number = 1,
  inner: boolean = false
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

Next, let's draw some hexagons, we will use [hexagonpath()](/utils/hexagonpath) function for this:

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

Buy default the grid is constructed using [circumscribed circle](https://en.wikipedia.org/wiki/Circumscribed_circle) or **outer radius**. There is also an boolean option `inner` in `hexgrid()` that indicates that grid is constructed using [inscribed circle](https://en.wikipedia.org/wiki/Inscribed_figure) or **inner radius**.

Let's use the latest example but add `inner = true` to `hexgrid()`:

```md{3,10,17}
<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50,inner = true)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50,inner = true)"
    :d="hexagonpath(25)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,inner = true)"
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
    v-for="g in hexgrid(6,6,50,inner = true)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50,inner = true)"
    :d="hexagonpath(25)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,inner = true)"
    :cx="g.x"
    :cy="g.y"
    r="25"
    stroke="#aaa"
    fill="none"
  />
</svg>

Great but notice that the hexagons do not "fit" to this new grid. We also need to add `inner = true` to `hexagonpath()` function:

```md{11}
<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50,inner = true)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50,inner = true)"
    :d="hexagonpath(25,inner = true)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,inner = true)"
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
    v-for="g in hexgrid(6,6,50,inner = true)"
    :cx="g.x"
    :cy="g.y"
    r="1"
    fill="red"
  />
  <path
    v-for="g in hexgrid(6,6,50,inner = true)"
    :d="hexagonpath(25,inner = true)"
    :transform="translate(g.x,g.y)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,inner = true)"
    :cx="g.x"
    :cy="g.y"
    r="25"
    stroke="#aaa"
    fill="none"
  />
</svg>

Here's the interactive example showing off inner and inner construction of the hexagon grid:

<svg width="200" height="200">
  <circle
    v-for="g in hexgrid(6,6,50,v.inner)"
    :cx="g.x"
    :cy="g.y"
    :r="25"
    stroke="black"
    :fill="[14,15,21].includes(g.index) ? 'rgba(255,0,0,0.5)' : 'none'"
    opacity="0.25"
  />
  <circle
    v-for="g in hexgrid(6,6,50,v.inner)"
    v-show="[14,15,21].includes(g.index)"
    :cx="g.x"
    :cy="g.y"
    :r="50"
    stroke="red"
    fill="none"
  />
  <path
    v-for="g in hexgrid(6,6,50,v.inner)"
    :transform="translate(g.x,g.y)"
    :d="hexagonpath(25,v.inner)"
    stroke="black"
    fill="none"
  />
  <circle
    v-for="g in hexgrid(6,6,50,v.inner)"
    :cx="g.x"
    :cy="g.y"
    :r="1"
    fill="red"
  />
</svg>

> <button v-on:click="v.inner = !v.inner">inner = {{ v.inner ?? false }}</button>

#### Example

Finally, no hexagon tutorial would be complete without _arab-esque_ tiling patterns:

```md
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

<v-slider v-model="v.r" :value="50" max="50" />
> Hexagon radius `v.r` = {{ v.r }}

<v-slider v-model="v.r2" :value="50" />
> Circle radius `v.r2` = {{ v.r2 }}
```

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

<v-slider v-model="v.r" :value="50" max="50" />
> Hexagon radius `v.r` = {{ v.r }}

<v-slider v-model="v.r2" :value="50" />
> Circle radius `v.r2` = {{ v.r2 }}

#### Prior art

https://designstem.github.io/fachwerk/docs/#/f-hex-pattern

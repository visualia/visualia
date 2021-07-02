# Grids

## rectgrid

Generates a rectangular grid. Returns `x` and `y` coordinates for each grid item and also `col`, `row` and item `index`.

```ts
function rectgrid(
  countX: number,
  countY: number,
  step: number = 1
): {
  x: number;
  y: number;
  col: number;
  row: number;
  index: number;
}[];
```

#### Usage

```ts
> {{ rectgrid(2,2,2) }}
```

<blockquote style="white-space: pre">{{ rectgrid(2,2,2) }}</blockquote>

#### Example

Let's generate a `4 * 4` rectangular grid and map each grid item index into a hue value:

```md
<svg width="200" height="200">
  <circle
    v-for="g in rectgrid(4,4,50)"
    :cx="g.x + 25"
    :cy="g.y + 25"
    :r="25"
    :fill="hue(map(g.index, 0, 4 * 4, 0, 360))"
    v-on:mouseover="v.g = g"
  />
</svg>

> {{ v.g }}
```

Hover over the grid circles to see the grid item data:

<svg width="200" height="200">
  <circle
    v-for="g in rectgrid(4,4,50)"
    :cx="g.x + 25"
    :cy="g.y + 25"
    :r="25"
    :fill="hue(map(g.index, 0, 4 * 4, 0, 360))"
    v-on:mouseover="v.g = g"
  />
</svg>

> {{ v.g }}

#### See also

https://designstem.github.io/fachwerk/docs/#/f-grid-pattern

https://visualia.github.io/visualia_original/#helper-functions_gridpoints

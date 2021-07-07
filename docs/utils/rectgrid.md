# rectgrid

Generates a rectangular grid. Returns `x y` coordinates for each grid item plus corresponding `col`, `row` and item `index`.

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
> {{ rectgrid(2,2,10) }}
```

<blockquote style="white-space: pre">{{ rectgrid(2,2,10) }}</blockquote>

#### Example

Let's generate a rectangular grid with `4 * 4` items and map each item index to a hue value. Hovering / tapping on items shows its data.

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

#### Prior art

https://designstem.github.io/fachwerk/docs/#/f-grid-pattern

https://visualia.github.io/visualia_original/#helper-functions_gridpoints

# Grids

## rectgrid

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

<svg width="400" height="400" class="d">
  <circle
    v-for="g in rectgrid(8,8,400/8)"
    :cx="g.x"
    :cy="g.y"
    :r="400/16"
    :fill="hue(map(g.index, 0, 8 * 8, 0, 360))"
  />
  <text 
    v-for="g in rectgrid(8,8,400/8)"
    :x="g.x"
    :y="g.y"
    text-anchor="middle"
    dominant-baseline="middle"
  >
    {{ g.index }}
  </text>
</svg>

<svg width="400" height="400" class="d">
  <circle 
    v-for="g in rectgrid(10,10,10)"
    :cx="g.x"
    :cy="g.y"
    :r="g.index / 5"
    opacity="0.1"
  />
</svg>

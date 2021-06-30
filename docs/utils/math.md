# Math

## map

Remaps the number from one linear range to another. Inspired by p5 / Processing [map()](https://p5js.org/reference/#/p5/map) and D3 [scaleLinear()](https://github.com/d3/d3-scale#scaleLinear) functions.

```ts
function map(
  value: number,
  start1: number,
  stop1: number,
  start2: number,
  stop2: number
): number;
```

#### Usage

First let's create 10 circles with `x` coordinates {{ range(1,10) }}.

Using `map()` it is easy to transform `x` coordinates from `1-10` range to `0-400` range:

```md{3-4}
<svg width="400" height="20">
  <circle
    v-for="x in 10"
    :cx="map(x,1,10,0,400)"
    cy="10"
    r="10"
  />
</svg>
```

<svg width="400" height="20">
  <circle
    v-for="x in 10"
    :cx="map(x,1,10,0,400)"
    cy="10"
    r="10"
  />
</svg>

Let's also use `x` to map circle radiuses to `1-20` range:

```md{6}
<svg width="400" height="40">
  <circle
    v-for="x in 10"
    :cx="map(x,1,10,0,400)"
    cy="20"
    :r="map(x,1,10,1,20)"
  />
</svg>
```

<svg width="400" height="40">
  <circle
    v-for="x in 10"
    :cx="map(x,1,10,0,400)"
    cy="20"
    :r="map(x,1,10,1,20)"
  />
</svg>

Finally, instead of `10`, let's have `20` circles. Also use `x` to map circle opacities to `0.1 - 0.9` range:

```md{3,7}
<svg width="400" height="40">
  <circle
    v-for="x in 20"
    :cx="map(x,1,20,0,400)"
    cy="20"
    :r="map(x,1,20,1,20)"
    :opacity="map(x,1,20,0.1,0.9)"
  />
</svg>
```

<svg width="400" height="40">
  <circle
    v-for="x in 20"
    :cx="map(x,1,20,0,400)"
    cy="20"
    :r="map(x,1,20,1,20)"
    :opacity="map(x,1,20,0.1,0.9)"
  />
</svg>

#### See also

https://visualia.github.io/visualia_original/#helper-functions_scale

https://designstem.github.io/fachwerk/docs/#/scale

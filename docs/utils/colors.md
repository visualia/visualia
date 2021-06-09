# Colors

## rgb

Ouputs a CSS color string in [rgb() notation](<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/rgb()>).

`rgb()` accepts following parameters:

`r` as **red** ranging from 0 to 255
`g` as **green** from 0 to 255
`b` as **blue** from 0 to 255

#### Function signature

```ts
function rgb(r: number, g: number, b: number): string;
```

#### Usage

```md
<svg :width="256 * 2" height="40">
  <rect v-for="r in range(0,255)" :x="r" y="0" width="2" height="40" :fill="rgb(r,0,0)" v-on:mouseover="set('r',r)" />
</svg>

> `rgb({{ get('r', 0) }},0,0)`
```

Hover over the colors to see the `rgb()` values:

<svg :width="256 * 2" height="40">
  <rect v-for="r in range(0,255)" :x="r" y="0" width="2" height="40" :fill="rgb(r,0,0)" v-on:mouseover="set('r',r)" />
</svg>

> `rgb({{ get('r', 0) }},0,0)`

## rgba

Ouputs a CSS color string in [rgba() notation](<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/rgba()>).

`rgba()` accepts following parameters:

`r` as **red** ranging from 0 to 255
`g` as **green** from 0 to 255
`b` as **blue** from 0 to 255
`a` as **alpha** from 0 to 1

#### Function signature

```ts
function rgba(r: number, g: number, b: number, a: number = 1): string;
```

#### Usage

```md
<svg :width="256 * 2" height="40">
  <rect v-for="a in range(0,255)" :x="a" y="0" width="2" height="40" :fill="rgba(255,0,0,a / 255)" v-on:mouseover="set('rgba',a)" />
</svg>

> `rgba(255,0,0,{{ get('rgba', 0) / 255 }})`
```

Hover over the colors to see the `rgba()` values:

<svg :width="256 * 2" height="40">
  <rect v-for="a in range(0,255)" :x="a" y="0" width="2" height="40" :fill="rgba(255,0,0,a / 255)" v-on:mouseover="set('rgba',a)" />
</svg>

> `rgba(255,0,0,{{ get('rgba', 0) / 255 }})`

## hsl

Ouputs a CSS color string in [hsl() notation](<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl()>).

`hsl()` accepts following parameters:

`h` as **hue** ranging from 0 to 360
`s` as **saturation** from 0 to 100
`l` as **lightness** from 0 to 100

#### Function signature

```ts
hsl(h: number, s: number, l: number): string
```

#### Usage

```md
<svg :width="360 * 2" height="40">
  <rect v-for="h in range(0,360)" :x="h" y="0" width="2" height="40" :fill="hsl(h,100,50)" v-on:mouseover="set('h',h)" />
</svg>

> `hsl({{ get('h', 0) }},100,50)`

<svg :width="100 * 2" height="40">
  <rect v-for="s in range(0,100)" :x="s" y="0" width="2" height="40" :fill="hsl(0,s,50)" v-on:mouseover="set('s',s)" />
</svg>

> `hsl(0,{{ get('s', 0) }},50)`

<svg :width="100 * 2" height="40">
  <rect v-for="l in range(0,100)" :x="l" y="0" width="2" height="40" :fill="hsl(0,100,l)" v-on:mouseover="set('l',l)" />
</svg>

> `hsl(0,100,{{ get('l', 0) }})`
```

Hover over the colors to see the `hsl()` values:

<svg :width="360 * 2" height="40">
  <rect v-for="h in range(0,360)" :x="h" y="0" width="2" height="40" :fill="hsl(h,100,50)" v-on:mouseover="set('h',h)" />
</svg>

> `hsl({{ get('h', 0) }},100,50)`

<svg :width="100 * 2" height="40">
  <rect v-for="s in range(0,100)" :x="s" y="0" width="2" height="40" :fill="hsl(0,s,50)" v-on:mouseover="set('s',s)" />
</svg>

> `hsl(0,{{ get('s', 0) }},50)`

<svg :width="100 * 2" height="40">
  <rect v-for="l in range(0,100)" :x="l" y="0" width="2" height="40" :fill="hsl(0,100,l)" v-on:mouseover="set('l',l)" />
</svg>

> `hsl(0,100,{{ get('l', 0) }})`

## hsla

Ouputs a CSS color string in [hsla() notation](<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsla()>).

`hsla()` accepts following parameters:

`h` as **hue** ranging from 0 to 360
`s` as **saturation** from 0 to 100
`l` as **lightness** from 0 to 100
`a` as **alpha** ranging from 0 and 1.

#### Function signature

```ts
hsla(h: number, s: number, l: number, a: number): string
```

#### Usage

Hover over the colors to see the `hsla()` values:

<svg :width="100 * 2" height="40">
  <rect v-for="a2 in range(0,100)" :x="a2" y="0" width="2" height="40" :fill="hsla(0,100,50,a2 / 100)" v-on:mouseover="set('a2',a2)" />
</svg>

> `hsla(0,100,50,{{ get('a2', 0) }})`

## gray

To simplify working with grays, there is an addional function to generate two hundred fifty six shades of gray. It is inspired by Processing / p5 [fill()](https://p5js.org/reference/#/p5/fill) function.

`gray(value)` accepts a single parameter, `value` ranging from 0 to 255.

::: warning Not in a spec
`gray()` is not part of the official CSS specification, it's only provided as wrapper around `rgb(value,value,value)` function.
:::

#### Function signature

```ts
function gray(value: number): string;
```

#### Usage

```md
<svg :width="256 * 2" height="40">
  <rect v-for="g in range(0,255)" :x="g" y="0" width="2" height="40" :fill="gray(g)" v-on:mouseover="set('g',g)" />
</svg>

> `gray({{ get('g', 0) }})` or `rgb({{ get('g', 0) }},{{ get('g', 0) }},{{ get('g', 0) }})`
```

Hover over the colors to see the `gray()` values:

<svg :width="256 * 2" height="40">
  <rect v-for="g in range(0,255)" :x="g" y="0" width="2" height="40" :fill="gray(g)" v-on:mouseover="set('g',g)" />
</svg>

> `gray({{ get('g', 0) }})` or `rgb({{ get('g', 0) }},{{ get('g', 0) }},{{ get('g', 0) }})`

# Colors

## rgb

Ouputs a CSS color string in [rgb() notation](<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/rgb()>).

```ts
function rgb(r: number, g: number, b: number): string;
```

`rgb()` accepts following parameters:

`r` as **red** ranging from 0 to 255
`g` as **green** from 0 to 255
`b` as **blue** from 0 to 255

#### Usage

```md
<svg :width="256 * 2" height="40">
  <rect v-for="r in range(0,255)" :x="r" y="0" width="2" height="40" :fill="rgb(r,0,0)" v-on:mouseover="v.r = r" />
</svg>

> `rgb({{ v.r ?? 0 }},0,0)`
```

Hover over the colors to see the `rgb()` values:

<svg :width="256 * 2" height="40">
  <rect v-for="r in range(0,255)" :x="r" y="0" width="2" height="40" :fill="rgb(r,0,0)" v-on:mouseover="v.r = r" />
</svg>

> `rgb({{ v.r ?? 0 }},0,0)`

## rgba

Ouputs a CSS color string in [rgba() notation](<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/rgba()>).

```ts
function rgba(r: number, g: number, b: number, a: number = 1): string;
```

`rgba()` accepts following parameters:

`r` as **red** ranging from 0 to 255
`g` as **green** from 0 to 255
`b` as **blue** from 0 to 255
`a` as **alpha** from 0 to 1

#### Usage

```md
<svg :width="256 * 2" height="40">
  <rect v-for="a in range(0,255)" :x="a" y="0" width="2" height="40" :fill="rgba(255,0,0,a / 255)" v-on:mouseover="v.rgba = a" />
</svg>

> `rgba(255,0,0,{{ (v.rgba ?? 0) / 255 }})`
```

Hover over the colors to see the `rgba()` values:

<svg :width="256 * 2" height="40">
  <rect v-for="a in range(0,255)" :x="a" y="0" width="2" height="40" :fill="rgba(255,0,0,a / 255)" v-on:mouseover="v.rgba = a" />
</svg>

> `rgba(255,0,0,{{ (v.rgba ?? 0) / 255 }})`

## hsl

Ouputs a CSS color string in [hsl() notation](<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl()>).

```ts
hsl(h: number, s: number, l: number): string
```

`hsl()` accepts following parameters:

`h` as **hue** ranging from 0 to 360
`s` as **saturation** from 0 to 100
`l` as **lightness** from 0 to 100

#### Usage

```md
<svg :width="360 * 2" height="40">
  <rect v-for="h in range(0,360)" :x="h" y="0" width="2" height="40" :fill="hsl(h,100,50)" v-on:mouseover="v.h = h" />
</svg>

> `hsl({{ v.h ?? 0 }},100,50)`

<svg :width="100 * 2" height="40">
  <rect v-for="s in range(0,100)" :x="s" y="0" width="2" height="40" :fill="hsl(0,s,50)" v-on:mouseover="v.s = s" />
</svg>

> `hsl(0,{{ v.s ?? 0 }},50)`

<svg :width="100 * 2" height="40">
  <rect v-for="l in range(0,100)" :x="l" y="0" width="2" height="40" :fill="hsl(0,100,l)" v-on:mouseover="v.l = l" />
</svg>

> `hsl(0,100,{{ v.l ?? 0 }})`
```

Hover over the colors to see the `hsl()` values:

<svg :width="360 * 2" height="40">
  <rect v-for="h in range(0,360)" :x="h" y="0" width="2" height="40" :fill="hsl(h,100,50)" v-on:mouseover="v.h = h" />
</svg>

> `hsl({{ v.h ?? 0 }},100,50)`

<svg :width="100 * 2" height="40">
  <rect v-for="s in range(0,100)" :x="s" y="0" width="2" height="40" :fill="hsl(0,s,50)" v-on:mouseover="v.s = s" />
</svg>

> `hsl(0,{{ v.s ?? 0 }},50)`

<svg :width="100 * 2" height="40">
  <rect v-for="l in range(0,100)" :x="l" y="0" width="2" height="40" :fill="hsl(0,100,l)" v-on:mouseover="v.l = l" />
</svg>

> `hsl(0,100,{{ v.l ?? 0 }})`

## hsla

Ouputs a CSS color string in [hsla() notation](<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsla()>).

```ts
hsla(h: number, s: number, l: number, a: number): string
```

`hsla()` accepts following parameters:

`h` as **hue** ranging from 0 to 360
`s` as **saturation** from 0 to 100
`l` as **lightness** from 0 to 100
`a` as **alpha** ranging from 0 and 1.

#### Usage

Hover over the colors to see the `hsla()` values:

<svg :width="100 * 2" height="40">
  <rect v-for="a2 in range(0,100)" :x="a2" y="0" width="2" height="40" :fill="hsla(0,100,50,a2 / 100)" v-on:mouseover="v.a2 = a2" />
</svg>

> `hsla(0,100,50,{{ v.a2 ?? 0 }})`

## hue

To simplify working with hues, there is also a `hue()` function.

```ts
function hue(h: number): string;
```

#### Usage

Hover over the colors to see the `hue()` values:

<svg :width="360 * 2" height="40">
  <rect v-for="h2 in range(0,360)" :x="h2" y="0" width="2" height="40" :fill="hsl(h2,100,50)" v-on:mouseover="v.h2 = h2" />
</svg>

> `hue({{ v.h2 ?? 0 }})`

::: warning Not in a spec
`hue()` is not part of the official CSS colors specification, it's only provided as wrapper around `hsla(h,50,100,1)` function.
:::

## gray

To simplify working with grays, there is an addional function to generate two hundred fifty six shades of gray. It is inspired by Processing / p5 [fill()](https://p5js.org/reference/#/p5/fill) function.

```ts
function gray(value: number): string;
```

`gray(value)` accepts a single parameter, `value` ranging from 0 to 255.

::: warning Not in a spec
`gray()` is not part of the official CSS colors specification, it's only provided as wrapper around `rgb(value,value,value)` function.
:::

#### Usage

```md
<svg :width="256 * 2" height="40">
  <rect v-for="g in range(0,255)" :x="g" y="0" width="2" height="40" :fill="gray(g)" v-on:mouseover="v.g = g" />
</svg>

> `gray({{ v.g ?? 0 }})` or `rgb({{ v.g ?? 0 }},{{ v.g ?? 0 }},{{ v.g ?? 0 }})`
```

Hover over the colors to see the `gray()` values:

<svg :width="256 * 2" height="40">
  <rect v-for="g in range(0,255)" :x="g" y="0" width="2" height="40" :fill="gray(g)" v-on:mouseover="v.g = g" />
</svg>

> `gray({{ v.g ?? 0 }})` or `rgb({{ v.g ?? 0 }},{{ v.g ?? 0 }},{{ v.g ?? 0 }})`

#### See also

https://designstem.github.io/fachwerk/docs/#/rgb

https://designstem.github.io/fachwerk/docs/#/hsl

https://visualia.github.io/visualia_original/#helper-functions_rgb

https://visualia.github.io/visualia_original/#helper-functions_hsl

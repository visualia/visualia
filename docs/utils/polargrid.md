# polargrid

Generates a polar grid. Returns `x y` coordinates for each grid item plus corresponding item `index`.

```ts
function polargrid(
  count: number,
  radius: number,
  closed: boolean = false
): {
  x: number;
  y: number;
  angle: number;
  radius: number;
  index: number;
}[];
```

#### Usage

```
> {{ polargrid(3,10) }}
```

> <pre>{{ polargrid(3,10) }}</pre>

#### Example I

Let's generate a polar grid with `8` items and map each item index to the hue value. Hovering / tapping on items shows its data.

```md
<svg width="200" height="200">
  <circle
    v-for="g in polargrid(8,65)"
    :cx="g.x + 100"
    :cy="g.y + 100"
    :r="25"
    :fill="hue(map(g.index, 0, 8, 0, 360))"
    v-on:mouseover="v.g2 = g"
  />
</svg>

> {{ v.g2 }}
```

<svg width="200" height="200">
  <circle
    v-for="g in polargrid(8,65)"
    :cx="g.x + 100"
    :cy="g.y + 100"
    :r="25"
    :fill="hue(map(g.index, 0, 8, 0, 360))"
    v-on:mouseover="v.g2 = g"
  />
</svg>

> {{ v.g2 }}

#### Example II

Here's another example, a tribute to [Braun T49](https://graphicdesign.stackexchange.com/questions/113981/is-there-a-specific-name-for-a-concentric-dots-pattern-in-a-circle).

```md
<svg width="200" height="200">
  <g v-for="(count, r) in [1,6,12,20,24,32,36]">
    <circle
      v-for="g in polargrid(count,r * 15)"
      :cx="g.x + 100"
      :cy="g.y + 100"
      r="4"
    />
  </g>
</svg>
```

<svg width="200" height="200">
  <g v-for="(count, r) in [1,6,12,20,24,32,36]">
    <circle
      v-for="g in polargrid(count,r * 15)"
      :cx="g.x + 100"
      :cy="g.y + 100"
      r="4"
    />
  </g>
</svg>

#### Example III

Third example assigns the `count` parameter of the polar grid to a global variable `v.count` that allows to control the number of grid items:

```md
<svg width="200" height="200">
  <line
    v-for="g in polargrid(v.count ?? 128,100)"
    x1="100"
    y1="100"
    :x2="g.x + 100"
    :y2="g.y + 100"
    :r="25"
    stroke="black"
  />
</svg>

<v-slider v-model="v.count" :value="128" max="256" />

> v.count: {{ v.count }}
```

<svg width="200" height="200">
  <line
    v-for="g in polargrid(v.count ?? 128,100)"
    x1="100"
    y1="100"
    :x2="g.x + 100"
    :y2="g.y + 100"
    :r="25"
    stroke="black"
  />
</svg>

<v-slider v-model="v.count" :value="128" max="256" />

> v.count: {{ v.count }}

#### See also

https://designstem.github.io/fachwerk/docs/#/f-circle-pattern

https://visualia.github.io/visualia_original/#helper-functions_circlepoints

# hexagonpath

Generates a hexagon path as a SVG path string.

```ts
function hexagonpath(radius: number, inner: boolean = false): string;
```

#### Usage

Here is the `hexagonpath()` with togglable `inner` parameter:

```md
<svg width="200" height="200">
  <circle cx="100" cy="100" :r="50" stroke="#aaa" fill="none" />
  <line v-if="!v.inner" x1="100" y1="100" :x2="polar(60,50).x + 100" :y2="polar(60,50).y + 100" stroke="#aaa" />
  <line v-if="v.inner" x1="100" y1="100" x2="150" y2="100" stroke="#aaa" />
  <path
    :d="linepath(polargrid(6, 50, v.inner, true))"
    stroke="red"
    fill="none"
    transform="translate(100,100)"
  />
</svg>

> `hexagonpath(50, {{ v.inner }})`

<button v-on:click="v.inner = !v.inner">inner = {{ v.inner ?? false }}</button>
```

<svg width="200" height="200">
  <circle cx="100" cy="100" :r="50" stroke="#aaa" fill="none" />
  <line v-if="!v.inner" x1="100" y1="100" :x2="polar(60,50).x + 100" :y2="polar(60,50).y + 100" stroke="#aaa" />
  <line v-if="v.inner" x1="100" y1="100" x2="150" y2="100" stroke="#aaa" />
  <path
    :d="linepath(polargrid(6, 50, v.inner, true))"
    stroke="red"
    fill="none"
    transform="translate(100,100)"
  />
</svg>

> `hexagonpath(50, inner = {{ v.inner ?? false }})`

<button v-on:click="v.inner = !v.inner">inner = {{ v.inner ?? false }}</button>

#### Prior art

https://designstem.github.io/fachwerk/docs/#/f-hexagon

https://visualia.github.io/visualia_original/#graphics_hexagon

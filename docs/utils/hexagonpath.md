# hexagonpath

Generates a hexagon path as a SVG path string.

```ts
function hexagonpath(radius: number, outer: boolean = false): string;
```

#### Usage

Here is the `hexagonpath()` with togglable `outer` parameter:

```md
<svg width="200" height="200">
  <circle cx="100" cy="100" :r="50" stroke="#aaa" fill="none" />
  <path
    :d="hexagonpath(50, v.outer)"
    stroke="red"
    fill="none"
    transform="translate(100,100)"
  />
</svg>

> `hexagonpath(50, {{ v.outer }})`

<button v-on:click="v.outer = !v.outer">outer = {{ v.outer ?? false }}</button>
```

<svg width="200" height="200">
  <circle cx="100" cy="100" :r="50" stroke="#aaa" fill="none" />
  <path
    :d="hexagonpath(50, v.outer)"
    stroke="red"
    fill="none"
    transform="translate(100,100)"
  />
</svg>

> `hexagonpath(50, {{ v.outer }})`

<button v-on:click="v.outer = !v.outer">outer = {{ v.outer ?? false }}</button>

#### Implementation

This function is implemented using [linepath()](/utils/linepath) and [polargrid()](/utils/polargrid) functions composed together:

```md{4}
<svg width="200" height="200">
  <circle cx="100" cy="100" :r="50" stroke="#aaa" fill="none" />
  <path
    :d="linepath(polargrid(6, 50, v.outer, true))"
    stroke="red"
    fill="none"
    transform="translate(100,100)"
  />
</svg>

<button v-on:click="v.outer = !v.outer">outer = {{ v.outer ?? false }}</button>
```

<svg width="200" height="200">
  <circle cx="100" cy="100" :r="50" stroke="#aaa" fill="none" />
  <path
    :d="linepath(polargrid(6, 50, v.outer, true))"
    stroke="red"
    fill="none"
    transform="translate(100,100)"
  />
</svg>

<button v-on:click="v.outer = !v.outer">outer = {{ v.outer ?? false }}</button>

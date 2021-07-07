# v-svg

A thin wrapper around `<svg>` element, offering useful extra functionality.

#### Padding

SVG default coordinate system starts at top left corner at `0 0` position. While geometrically correct, it might lead into visual artifacts when SVG elements get close to the edge of the SVG elements: borders, grids etc.

In some cases it is useful have a small padding (also know as _bleed_ in prepress community) around SVG to accommodate element overlaps.

Compare the following examples, here's the regular `<svg>` **without padding**:

```md
<svg width="200" height="200">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="2" fill="#aaa" />
  <rect width="100" height="100" fill="none" stroke="black" />
</svg>
```

Note the uneven borders of the rectangle and cutoff circle sides on a grid:

<svg width="200" height="200">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="2" fill="#aaa" />
  <rect width="100" height="100" fill="none" stroke="black" />
</svg>

Here is `<v-svg>` **with padding** of `10`:

```md{1}
<v-svg width="200" height="200" padding="10">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="2" fill="#aaa" />
  <rect width="100" height="100" fill="none" stroke="black" />
</v-svg>
```

<v-svg width="200" height="200" padding="10">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="2" fill="#aaa" />
  <rect width="100" height="100" fill="none" stroke="black" />
</v-svg>

#### Mouse interaction

`<v-svg>` has a `v-model` functionality that emits current mouse coordinates inside the SVG element (correctly handling the `viewBox` coordinate transformations):

```md
<v-svg v-model="v.mouse" width="200" height="200" padding="10">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="2" fill="#aaa" />
</v-svg>
```

<v-svg v-model="v.mouse" width="200" height="200" padding="10">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="2" fill="#aaa" />
</v-svg>

> v.mouse = `{{ v.mouse }}`

Using the mouse data we can easily add interacive elements to the SVG. Hover over the SVG below and click / tap to adjust circle size:

```md{3}
<v-svg v-model="v.mouse2" width="200" height="200" padding="10">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="2" fill="#aaa" />
  <circle :cx="v.mouse2?.x" :cy="v.mouse2?.y" :r="v.mouse.pressed ? 30 : 10" fill="red" opacity="0.8" />
</v-svg>
```

<v-svg v-model="v.mouse" width="200" height="200" padding="10">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="2" fill="#aaa" />
  <circle :cx="v.mouse?.x" :cy="v.mouse?.y" :r="v.mouse.pressed ? 30 : 10" fill="red" opacity="0.8" />
</v-svg>

{{ v }}

#### Responsive

`<v-svg>` adjusts it's width to page width when using on mobile devices.

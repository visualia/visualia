# v-svg

`<v-svg>` is a thin wrapper component on top of `<svg>` element, providing quality-of-life enhancements for SVG: mobile support, content padding, content centering, and download functionality.

#### Mobile support

When viewing the SVG on mobile devicesm `<v-svg>` adjusts its contents to the page width.

#### Padding

SVG default coordinate system starts at top left corner at `0 0` position. While geometrically correct, it might lead into visual artifacts when SVG elements get close to the edge of the SVG elements: borders, grids etc.

```md
<svg width="200" height="200" class="shadow">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="1" />
  <rect width="100" height="100" fill="none" stroke="black" />
</svg>
```

Note the uneven widths of rectangle borders and sizes of grid dots:

<svg width="200" height="200" class="shadow">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="1" />
  <rect width="100" height="100" fill="none" stroke="black" />
</svg>

It is useful have a `padding` (also know as _bleed_ in prepress community) in SVG document to avoid visual artifacts near the edges.

Here is `<v-svg>` with `padding` of `10`:

```md{1}
<v-svg width="200" height="200" padding="10" class="shadow">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="1" />
  <rect width="100" height="100" fill="none" stroke="black" />
</v-svg>
```

<v-svg width="200" height="200" padding="10" class="shadow">
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x" :cy="g.y" r="1" />
  <rect width="100" height="100" fill="none" stroke="black" />
</v-svg>

#### Centered

In many circumstances it is handy to set the SVG coordinate system to the center of the SVG, especially when working on radial symmetry. While it is possible to adjust `viewBox` attribute values manually, its easier to use `centered` attribute on `<v-svg>`:

```md{1}
<v-svg centered width="200" height="200">
  <circle r="100" fill="red" opacity="0.2" />
  <circle v-for="g in polargrid(v.count ?? 6,50)" :cx="g.x" :cy="g.y" r="50" fill="red" opacity="0.2"/>
</v-svg>

> v.count: {{ v.count ?? 6 }}

<v-slider v-model="v.count" :value="6" max="32" />
```

<v-svg centered width="200" height="200">
  <circle r="100" fill="red" opacity="0.2" />
  <circle v-for="g in polargrid(v.count ?? 6,50)" :cx="g.x" :cy="g.y" r="50" fill="red" opacity="0.2"/>
</v-svg>

> v.count: {{ v.count ?? 6 }}

<v-slider v-model="v.count" :value="6" max="32" />

#### Download

`<v-svg>` can react to the `"download"` global event that allow to download the SVG contents as a file.

As there might be many SVGs on a page, you need to identify the SVG with `id` attribute and pass it to the emitted event. The `id` parameter is also the filename of the downloaded SVG file.

```md{1,7}
<v-svg id="test" width="200" height="200" padding="10" centered>
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x - 100" :cy="g.y - 100" r="1" />
  <circle r="100" fill="red" opacity="0.2" />
  <circle v-for="g in polargrid(v.count ?? 6,50)" :cx="g.x" :cy="g.y" r="50" fill="red" opacity="0.2"/>
</v-svg>

<button v-on:click="emit('download', 'test')">Download test.svg</button>
```

<v-svg id="test" width="200" height="200" padding="10" centered>
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x - 100" :cy="g.y - 100" r="1" />
  <circle r="100" fill="red" opacity="0.2" />
  <circle v-for="g in polargrid(v.count ?? 6,50)" :cx="g.x" :cy="g.y" r="50" fill="red" opacity="0.2"/>
</v-svg>

<button v-on:click="emit('download', 'test')">Download test.svg</button>

::: tip Using downloaded SVG with padding

When you use `padding` attribute on `<v-svg>` and importing the downloaded SVG into vector graphics programs (for example [Figma](https://www.figma.com/)) it is recommended to set the top left position of the imported SVG to `x = -padding` and `y = -padding`.

In the case above it should be `x = -10` and `y = -10`.
:::

#### Prior art

[Fachwerk f-scene](https://designstem.github.io/fachwerk/docs/#/f-scene)

[Fachwerk f-artboard](https://designstem.github.io/fachwerk/docs/#/f-artboard)

[Visualia v-scene](https://visualia.github.io/visualia_original/#graphics_scene)

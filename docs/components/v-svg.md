# v-svg

A thin wrapper around `<svg>` element, offering extra functionality: mobile support, content padding, content centerid, and download functionality.

#### Responsive

`<v-svg>` adjusts its contents to the width to page width when using on mobile devices.

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

#### Centered

In many circumstances it is useful to set the SVG coordinate system to the center of the SVG, especially when working on radial symmetry. While it is possible to adjust `viewBox` attribute values manually, its easier to use `centered` attribute on `<v-svg>`:

```md{1}
<v-svg centered width="200" height="200">
  <circle r="100" fill="red" opacity="0.2" />
  <circle v-for="g in polargrid(6,50)" :cx="g.x" :cy="g.y" r="50" fill="red" opacity="0.2"/>
</v-svg>
```

<v-svg centered width="200" height="200">
  <circle r="100" fill="red" opacity="0.2" />
  <circle v-for="g in polargrid(6,50)" :cx="g.x" :cy="g.y" r="50" fill="red" opacity="0.2"/>
</v-svg>

#### Download

`<v-svg>` can react to the `"download"` global event that allow to download the SVG contents as a file.

As there might be many SVGs on a page, you need to identify the SVG with `id` attribute and pass it to the emitted event. The `id` parameter is also the filename of the downloaded SVG file.

```md{1,7}
<v-svg id="test" width="200" height="200" padding="10" centered>
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x - 100" :cy="g.y - 100" r="2" fill="#aaa" />
  <circle r="100" fill="red" opacity="0.2" />
  <circle v-for="g in polargrid(6,50)" :cx="g.x" :cy="g.y" r="50" fill="red" opacity="0.2"/>
</v-svg>

<button v-on:click="emit('download', 'test')">Download test.svg</button>
```

<v-svg id="test" width="200" height="200" padding="10" centered>
  <circle v-for="g in rectgrid(11,11,20)" :cx="g.x - 100" :cy="g.y - 100" r="2" fill="#aaa" />
  <circle r="100" fill="red" opacity="0.2" />
  <circle v-for="g in polargrid(6,50)" :cx="g.x" :cy="g.y" r="50" fill="red" opacity="0.2"/>
</v-svg>

<button v-on:click="emit('download', 'test')">Download test.svg</button>

#### See also

[f-scene](https://designstem.github.io/fachwerk/docs/#/f-scene)

[f-artboard](https://designstem.github.io/fachwerk/docs/#/f-artboard)

[scene](https://visualia.github.io/visualia_original/#graphics_scene)

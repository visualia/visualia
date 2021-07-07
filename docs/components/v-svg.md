# v-svg

```
<svg width="300" height="300">
```

<svg width="300" height="300" class="shadow">
  <rect width="300" height="300" fill="none" stroke="black" />
  <circle :cx="150" :cy="150" :r="150" opacity="0.1" />
  <circle v-for="g in rectgrid(11,11,30)" :cx="g.x" :cy="g.y" r="3" />
</svg>

```
<v-svg width="300" height="300" padding="20">
```

<v-svg id="test" width="300" height="300" class="shadow" padding="10" v-model="v.mouse">
  <rect width="300" height="300" fill="none" stroke="black" />
  <circle :cx="150" :cy="150" :r="150" opacity="0.1" />
  <g>
    <circle v-for="g in rectgrid(11,11,30)" :cx="g.x" :cy="g.y" r="3" />
  </g>
  <circle :cx="v.mouse?.x" :cy="v.mouse?.y" r="10" fill="red" opacity="0.8" />
</v-svg>

<button v-on:click="emit('download', 'test')">Download</button>

{{ v.mouse }}

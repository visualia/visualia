{{ rectGrid(0,399,40).length }}

<svg width="400" height="400">
<circle v-for="item in rectGrid(0,400,20)" :cx="item.x" :cy="item.y" :r="item.x / 25" opacity="0.1" />
<circle v-for="item in rectGrid(0,400,20)" :cx="item.x" :cy="item.y" r="1" />
</svg>

# Array utilities

## range

Generates a list of numbers between `from` and `to`. Modeled after Python's [range()](https://docs.python.org/3/library/stdtypes.html#range) function.

#### Function signature

```ts
export function range(from: number, to: number): number[];
```

#### Usage

```md
<v-slider set="length" :value="10" max="10" />
> range: {{ range(0, get('length')) }}
```

<v-slider set="length" :value="10" max="10" />
> range(0,{{ get('length') }}) = {{ range(0, get('length')) }}

The return value of `range()` is Javascript [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) so you can use all array methods to further process it.

For example, `.map()` provides a useful tool to adjust a step between range elements:

```md
> <v-slider set="step" :value="20" max="40" />
> step: {{ get('step') }}

<svg width="400" height="40">
  <circle v-for="x in range(0, 10).map(x => x * get('step'))" :cx="x" cy="20" r="10" opacity="0.1" />
</svg>
```

> <v-slider set="step" :value="20" max="40" />
> step: {{ get('step') }}

<svg width="400" height="40">
  <circle v-for="x in range(0, 10).map(x => x * get('step',20))" :cx="x" cy="20" r="10" opacity="0.1" />
</svg>

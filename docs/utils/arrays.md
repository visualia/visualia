# Array functions

## range

Generates a list of numbers between `from` and `to`. Inspired by Python's [range()](https://docs.python.org/3/library/stdtypes.html#range) function.

```ts
export function range(from: number, to: number): number[];
```

#### Usage

```md
> range(0,{{ v.length }}) = {{ range(0, v.length) }}

<v-slider v-model="v.length" :value="10" max="10" />
```

> range(0,{{ v.length ?? 1 }}) = {{ range(0, v.length) }}

<v-slider v-model="v.length" :value="1" min="1" max="10" />

The return value of `range()` is Javascript [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) so you can use all array methods to further process it.

For example, `.map()` provides a useful tool to adjust a step between range elements:

```md
<svg width="400" height="40">
  <circle v-for="x in range(0, 10).map(x => x * (v.step ?? 20))" :cx="x" cy="20" r="10" opacity="0.1" />
</svg>

> <v-slider v-model="v.step" :value="20" max="40" />
> step: {{ v.step }}
```

<svg width="400" height="40">
  <circle v-for="x in range(0, 10).map(x => x * (v.step ?? 20))" :cx="x" cy="20" r="10" opacity="0.1" />
</svg>

> <v-slider v-model="v.step" :value="20" max="40" />
> step: {{ v.step }}

## chunk

Accepts an `arr` array and returns array of elements split into groups the length of `size`.

Inspired by Lodash [\_.chunk()](https://lodash.com/docs/#chunk) function.

#### Function signature

```ts
function chunk(arr: any[], length: number): any[][];
```

#### Usage

Pass the array and the chunk size to the function:

```
> {{ chunk([0,1,2,3],2) }}
```

> {{ chunk([0,1,2,3],2) }}

If array can't be split evenly, the final chunk will be the remaining elements:

```
> {{ chunk([0,1,2,3],3) }}
```

> {{ chunk([0,1,2,3],3) }}

#### Usage with range function

You can also combine `chunk()` and `range()` functions:

```
> {{ chunk(range(0,15),4) }}
```

> {{ chunk(range(0,15),4) }}

Or even better, use `chunk()` and `range()` and some SVG to create a rectangular grid:

```md
<svg width="400" height="400">
  <g v-for="(row, y) in chunk(range(0,15),4)">
  <circle v-for="(index, x) in row" :cx="x * 100 + 50" :cy="y * 100 + 50" r="50" opacity="0.1" />
  <text v-for="(index, x) in row" :x="x * 100 + 50" :y="y * 100 + 50" text-anchor="middle" dominant-baseline="middle">
    {{ index }}
  </text>
  </g>
</svg>
```

<svg width="400" height="400">
  <g v-for="(row, y) in chunk(range(0,15),4)">
  <circle v-for="(index, x) in row" :cx="x * 100 + 50" :cy="y * 100 + 50" r="50" opacity="0.1" />
   <text v-for="(index, x) in row" :x="x * 100 + 50" :y="y * 100 + 50" text-anchor="middle" dominant-baseline="middle">{{ index }}</text>
  </g>
</svg>

# Random

## random

```ts
function random(min: number = 0, max: number = 1): number;
```

Generates a random floating-point number between two values. The function accepts the following parameters.

`min` minimum random value (0 by default)
`max` maximum random value (1 by default)

Inspired by Processing / p5 [random()](https://p5js.org/reference/#/p5/random) function.

#### Usage

To visualize the random values, let's generate a range of numbers using [range()](/utils/arrays#range) function and make each circle to have a random radius with `random(1,20)`.

```md
<svg width="400" height="40">
<circle v-for="x in range(0,19)" :cx="x * 20" cy="20" :r="random(1,20)" />
</svg>
```

<svg width="400" height="40">
<circle v-for="x in range(0,19)" :cx="x * 20" cy="20" :r="random(1,20)" />
</svg>

Let's also have a random opacity for each circle with `random(0.1,1)`

```md
<svg width="400" height="40">
<circle v-for="x in range(0,19)" :cx="x * 20" cy="20" :r="random(1,20)" :opacity="random(0.1,1)" />
</svg>
```

<svg width="400" height="40">
<circle v-for="x in range(0,19)" :cx="x * 20" cy="20" :r="random(1,20)" :opacity="random(0.1,1)" />
</svg>

Finally, let's use [hue()](/utils/colors#hue) function to make each circle to have its own color:

```md
<svg width="400" height="40">
  <circle v-for="x in range(0,19)" :cx="x * 20" cy="20" :r="random(1,20)" :fill="hue(random(0,360))" :opacity="0.5" />
</svg>
```

<svg width="400" height="40">
  <circle v-for="x in range(0,19)" :cx="x * 20" cy="20" :r="random(1,20)" :fill="hue(random(0,360))" :opacity="0.5" />
</svg>

#### See also

https://visualia.github.io/visualia_original/#helper-functions_random

https://designstem.github.io/fachwerk/docs/#/random

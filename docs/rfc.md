# Request For Comments

### RFC1: Directly expose globalvariable

Instead of getting and setting the global variables with `get()` and `set()`, expose the global variable state for both scripts and templates.

Possible syntaxes:

`v`
`var`
`vvv`
`live`

#### Slider

Compare setting a global variable `x` with a slider:

<v-slider v="x" />

```vue
<!-- Before -->

<v-slider set="x" />

<!-- After -->

<v-slider v="x" />

<!-- Alternatives -->

<v-slider var="x" />

<v-slider vvv="x" />

<v-slider live="x" />
```

#### Getting

> {{ v.x * 100 }}

Compare getting and computing with a global variable `x`

```vue
<!-- Before -->

{{ get("x") * 100 }}

<!-- After -->

{{ v.x * 100 }}

<!-- Alternatives -->

{{ var.x * 100 }}

{{ vvv.x * 100 }}

{{ live.x * 100 }}
```

#### Setting

```md
<!-- Before -->

<button v-on:click="set('a',100)">Set a to 100</button>

<!-- After -->

<button v-on:click="v.x = 100">Set a to 100</button>

<!-- Alternatives -->

<button v-on:click="var.x = 100">Set a to 100</button>

<button v-on:click="vvv.x = 100">Set a to 100</button>

<button v-on:click="live.x = 100">Set a to 100</button>
```

<button v-on:click="v.x = 100">Set a to 100</button>

```md
<!-- Before -->

<svg width="400" height="40">
  <circle :cx="get('x')" cy="20" r="10" />
</svg>

<!-- After -->

<svg width="400" height="40">
  <circle :cx="v.x" cy="20" r="10" />
</svg>

<!-- Alternatives -->

<svg width="400" height="40">
  <circle :cx="var.x" cy="20" r="10" />
</svg>

<svg width="400" height="40">
  <circle :cx="vvv.x" cy="20" r="10" />
</svg>

<svg width="400" height="40">
  <circle :cx="live.x" cy="20" r="10" />
</svg>
```

<svg width="400" height="40">
  <circle :cx="v.x" cy="20" r="10" />
</svg>

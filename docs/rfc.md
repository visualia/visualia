# Request For Comments

### RFC1: Direct access to global variables

Instead of getting and setting the global variables with `get()` and `set()`, expose the global variable state for both scripts and templates.

Possible syntaxes:

`v`
`var`
`vvv`
`live`

#### Slider

Compare setting and getting a global variable `x` with a slider:

<v-slider v="x" />

```vue
<!-- Before -->

<v-slider set="x" />
> {{ get("x") * 100 }}

<!-- After -->

<v-slider v="x" />
> {{ v.x * 100 }}

<!-- Alternatives -->

<v-slider var="x" />
> {{ var.x * 100 }}

<v-slider vvv="x" />
> {{ vvv.x * 100 }}

<v-slider live="x" />
> {{ live.x * 100 }}
```

#### Setting on click

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

#### Using on SVG

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

#### Usage in component

```vue
<!-- Before -->

<script setup>
import { computed } from "vue";
import { get } from "visualia";
const bigX = computed(() => get("x") * 100);
</script>

<!-- After -->

<script setup>
import { computed } from "vue";
import { v } from "visualia";
const bigX = computed(() => v.x * 100);
</script>

<!-- Alternatives -->

<script setup>
import { computed } from "vue";
import { var } from "visualia"; // !!! can not use var as variable name
const bigX = computed(() => v.x * 100);
</script>

<script setup>
import { computed } from "vue";
import { vvv } from "visualia";
const bigX = computed(() => vvv.x * 100);
</script>

<script setup>
import { computed } from "vue";
import { live } from "visualia";
const bigX = computed(() => live.x * 100);
</script>
```

#### Usage in component with a fallback

```vue
<!-- Before -->

<script setup>
import { computed } from "vue";
import { get } from "visualia";
const bigX = computed(() => get("x", 0) * 100);
</script>

<!-- After -->

<script setup>
import { computed } from "vue";
import { v } from "visualia";
const bigX = computed(() => (v.x || 0) * 100);
</script>

<!-- Alternatives -->

<script setup>
import { computed } from "vue";
import { var } from "visualia"; // !!! can not use var as variable name
const bigX = computed(() => (var.x || 0) * 100);
</script>

<script setup>
import { computed } from "vue";
import { vvv } from "visualia";
const bigX = computed(() => (vvv.x || 0) * 100);
</script>

<script setup>
import { computed } from "vue";
import { live } from "visualia";
const bigX = computed(() => (live.x || 0) * 100);
</script>
```

# Request For Comments

### RFC1: Direct access to global dataiables

Instead of getting and setting the global dataiables with `get()` and `set()`, expose the global dataiable state for both scripts and templates.

Possible syntaxes:

`v`
`vvv`
`data`
`live`

#### Getting all values

> {{ v }}

```vue
<!-- Before (not implemented currently) -->

> {{ get() }}

<!-- After -->

> {{ v }}

<!-- Alternatives -->

> {{ vvv }}

> {{ data }}

> {{ live }}
```

#### Setting slider and getting value

<v-slider v="x" />

```vue
<!-- Before -->

<v-slider set="x" />
> {{ get("x") * 100 }}

<!-- After -->

<v-slider v="x" />
> {{ v.x * 100 }}

<!-- Alternatives -->

<v-slider vvv="x" />
> {{ vvv.x * 100 }}

<v-slider data="x" />
> {{ data.x * 100 }}

<v-slider live="x" />
> {{ live.x * 100 }}
```

#### Getting nested values

```vue
<!-- Before (not implemented currently) -->

<v-mouse set="mouse" />
{{ get("mouse").x }}
{{ get("mouse").y }}

<!-- After -->

<v-mouse v="mouse" />
{{ v.mouse.x }}
{{ v.mouse.y }}

<!-- Alternatives -->

<v-mouse vvv="mouse" />
{{ vvv.mouse.x }}
{{ vvv.mouse.y }}

<v-mouse data="mouse" />
{{ data.mouse.x }}
{{ data.mouse.y }}

<v-mouse live="mouse" />
{{ live.mouse.x }}
{{ live.mouse.y }}
```

#### Setting on click

```md
<!-- Before -->

<button v-on:click="set('a',100)">Set a to 100</button>

<!-- After -->

<button v-on:click="v.x = 100">Set a to 100</button>

<!-- Alternatives -->

<button v-on:click="vvv.x = 100">Set a to 100</button>

<button v-on:click="data.x = 100">Set a to 100</button>

<button v-on:click="live.x = 100">Set a to 100</button>
```

<button v-on:click="v.x = 100">Set a to 100</button>

#### Usage on SVG

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
  <circle :cx="vvv.x" cy="20" r="10" />
</svg>

<svg width="400" height="40">
  <circle :cx="data.x" cy="20" r="10" />
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
import { data } from "visualia";
const bigX = computed(() => data.x * 100);
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
import { data } from "visualia";
const bigX = computed(() => (data.x || 0) * 100);
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

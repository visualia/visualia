# Miscellaneous

## Brand image

```md
<v-slider set="offset" max="320" :value="70" step="any" style="width: 100%" />

> Offset: {{ get('offset') }}

<v-slider set="step" min="2" max="4" :value="2" step="any" style="width: 100%" />

> Step: {{ get('step') }}

<svg width="640" height="320" style="background: #eee">
  <circle v-for="y in 400" cx="320" cy="320"  :r="y * get('step')" stroke="red" fill="none" />
  <circle v-for="y in 400" cx="320" :cy="320 + get('offset')"  :r="y * get('step')" stroke="white" fill="none"  />
</svg>
```

<v-slider set="offset" max="320" :value="290" step="any" style="width: 100%" />

> Offset: {{ get('offset') }}

<v-slider set="step" min="2" max="4" :value="2" step="any" style="width: 100%" />

> Step: {{ get('step') }}

<svg width="640" height="320" style="background: #eee">
  <circle v-for="y in 400" cx="320" cy="320"  :r="y * get('step')" stroke="red" fill="none" />
  <circle v-for="y in 400" cx="320" :cy="320 + get('offset')"  :r="y * get('step')" stroke="white" fill="none"  />
</svg>

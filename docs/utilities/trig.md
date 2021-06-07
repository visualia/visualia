# Trigonometry functions

## deg2rad

Converts degrees to radians

```ts
export function deg2rad(deg: number): number;
```

<v-slider set="deg" max="360" />

> Degrees: {{ get('deg') }}<v-math>\degree</v-math>
> Radians {{ deg2rad(get('deg')) }} = {{ deg2rad(get('deg')) / Math.PI }} <v-math>\pi</v-math>

# Trigonometry functions

## deg2rad

Converts degrees to radians

```ts
export function deg2rad(deg: number): number;
```

#### Usage

```md
<v-slider set="deg" max="360" />
> Degrees: {{ get('deg') }}°
> Radians {{ deg2rad(get('deg')) }} = {{ deg2rad(get('deg')) / Math.PI }} π
```

<v-slider set="deg" max="360" />
> Degrees: {{ get('deg') }}°
> Radians {{ deg2rad(get('deg')) }} = {{ deg2rad(get('deg')) / Math.PI }} π

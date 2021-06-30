# Trigonometry functions

## polar

Converts polar coordinates to Cartesian coordinates

```ts
function polar(angle: number = 0, radius: number = 0): { x: number; y: number };
```

#### Usage

```md
<svg width="400" height="400">
  <g transform="translate(200,200)">
    <circle r="100" fill="none" stroke="black" />
    <line :x1="polar(v.angle,100).x" y1="-200" :x2="polar(v.angle,100).x" y2="200" stroke="red" />
    <line x1="-200" :y1="polar(v.angle,100).y" x2="200" :y2="polar(v.angle,100).y" stroke="green" />
    <circle :cx="polar(v.angle,100).x" :cy="polar(v.angle,100).y" r="10" />
  </g>
</svg>

> <v-slider v-model="v.angle" max="360" />
> Angle: {{ v.angle }}°
> Radius: 100
> Polar coordinates: {{ polar(v.angle,100) }}
```

<svg width="400" height="400">
  <g transform="translate(200,200)">
    <circle r="100" fill="none" stroke="black" />
    <line :x1="polar(v.angle,100).x" y1="-200" :x2="polar(v.angle,100).x" y2="200" stroke="red" />
    <line x1="-200" :y1="polar(v.angle,100).y" x2="200" :y2="polar(v.angle,100).y" stroke="green" />
    <circle :cx="polar(v.angle,100).x" :cy="polar(v.angle,100).y" r="10" />
  </g>
</svg>

> <v-slider v-model="v.angle" max="360" />
> Angle: {{ v.angle }}°
> Radius: 100
> Polar coordinates: {{ polar(v.angle,100) }}

## cartesian

Converts polar coordinates to Cartesian coordinates

```ts
function cartesian(
  angle: number = 0,
  radius: number = 0
): { x: number; y: number };
```

> <v-slider v-model="v.x" max="400" />
> v.x: {{ v.x }}

> <v-slider v-model="v.x" max="400" />
> v.y: {{ v.y }}

> Polar: {{ cartesian(v.x,v.y) }}

## deg2rad

Converts degrees to radians

```ts
function deg2rad(deg: number): number;
```

#### Usage

```md
> <v-slider v-model="v.deg" max="360" />
> Degrees: {{ v.deg }}°

> Radians {{ deg2rad(v.deg) }} = {{ deg2rad(v.deg) / Math.PI }} π
```

> <v-slider v-model="v.deg" max="360" />
> Degrees: {{ v.deg }}°

> Radians {{ deg2rad(v.deg) }} = {{ deg2rad(v.deg) / Math.PI }} π

## rad2deg

Converts radians to degrees

```ts
function rad2deg(rad: number): number;
```

#### Usage

```md
<v-slider v-model="v.rad" :max="2 * Math.PI" step="any" />
> Radians {{ v.rad }} = {{ v.rad / Math.PI }} π
> Degrees: {{ rad2deg(v.rad) }}°
```

<v-slider v-model="v.rad" :max="2 * Math.PI" step="any" />
> Radians {{ v.rad }} = {{ v.rad / Math.PI }} π
> Degrees: {{ rad2deg(v.rad) }}°

#### See also

https://designstem.github.io/fachwerk/docs/#/deg2rad

https://visualia.github.io/visualia_original/#helper-functions_trigonometry

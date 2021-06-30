# Trigonometry functions

## polar

Converts polar coordinates to Cartesian coordinates

#### Function signature

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

> <v-slider set="x" max="400" />
> x: {{ get('x') }}

> <v-slider set="y" max="400" />
> y: {{ get('y') }}

> Polar: {{ cartesian(get('x', 0),get('y', 0)) }}

## deg2rad

Converts degrees to radians

#### Function signature

```ts
function deg2rad(deg: number): number;
```

#### Usage

```md
> <v-slider set="deg" max="360" />
> Degrees: {{ get('deg') }}°

> Radians {{ deg2rad(get('deg')) }} = {{ deg2rad(get('deg')) / Math.PI }} π
```

> <v-slider set="deg" max="360" />
> Degrees: {{ get('deg') }}°

> Radians {{ deg2rad(get('deg')) }} = {{ deg2rad(get('deg')) / Math.PI }} π

## rad2deg

Converts radians to degrees

#### Function signature

```ts
function rad2deg(rad: number): number;
```

#### Usage

```md
<v-slider set="rad" :max="2 * Math.PI" step="any" />
> Radians {{ get('rad') }} = {{ get('rad') / Math.PI }} π
> Degrees: {{ rad2deg(get('rad')) }}°
```

<v-slider set="rad" :max="2 * Math.PI" step="any" />
> Radians {{ get('rad') }} = {{ get('rad') / Math.PI }} π
> Degrees: {{ rad2deg(get('rad')) }}°

#### See also

https://designstem.github.io/fachwerk/docs/#/deg2rad

https://visualia.github.io/visualia_original/#helper-functions_trigonometry

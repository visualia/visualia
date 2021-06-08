# Trigonometry functions

## pol2car

Converts polar coordinates to Cartesian coordinates

#### Function signature

```ts
function pol2car(angle: number, radius: number): { x: number; y: number };
```

#### Usage

```md
<v-slider set="deg" max="360" />
> Angle: {{ get('deg') }}°
> Radius: 100
> Cartesian: {{ pol2car(get('deg', 0),100) }}

<svg width="400" height="400">
  <g transform="translate(200,200)">
    <circle r="100" fill="none" stroke="black" />
    <line :x2="pol2car(get('deg'),100).x" :y2="pol2car(get('deg'),100).y" stroke="red" />
  </g>
</svg>
```

<v-slider set="deg" max="360" />
> Angle: {{ get('deg') }}°
> Radius: 100
> Cartesian: {{ pol2car(get('deg', 0),100) }}

<svg width="400" height="400">
  <g transform="translate(200,200)">
    <circle r="100" fill="none" stroke="black" />
    <line :x2="pol2car(get('deg'),100).x" :y2="pol2car(get('deg'),100).y" stroke="red" />
  </g>
</svg>

## car2pol

Converts Cartesian coordinates to polar coordinates

#### Function signature

```ts
function pol2car(angle: number, radius: number): { x: number; y: number };
```

<v-slider set="x" max="400" />

<v-slider set="y" max="400" />

> x: {{ get('x') }}
> y: {{ get('y') }}
> Polar: {{ car2pol(get('x', 0),get('y', 0)) }}

## deg2rad

Converts degrees to radians

#### Function signature

```ts
function deg2rad(deg: number): number;
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

## rad2deg

Converts radians to degrees

#### Function signature

```ts
function rad2deg(rad: number): number;
```

#### Usage

```md
<v-slider set="rad" :max="2 * Math.PI" step="0.0001" />
> Radians {{ get('rad') }} = {{ get('rad') / Math.PI }} π
> Degrees: {{ rad2deg(get('rad')) }}°
```

<v-slider set="rad" :max="2 * Math.PI" step="0.0001" />
> Radians {{ get('rad') }} = {{ get('rad') / Math.PI }} π
> Degrees: {{ rad2deg(get('rad')) }}°

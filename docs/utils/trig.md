# Trigonometry functions

## pol2car

Converts polar coordinates to Cartesian coordinates. Inspired by [pol2cart()](https://rdrr.io/cran/useful/man/pol2cart.html) function in R and Matlab.

```ts
function pol2car(
  angle: number = 0,
  radius: number = 0
): { x: number; y: number };
```

#### Usage

```md
<svg width="400" height="400">
  <g transform="translate(200,200)">
    <circle r="100" fill="none" stroke="black" />
    <circle :cx="pol2car(v.angle,100).x" :cy="polar(v.angle,100).y" r="10" />
  </g>
</svg>

> <v-slider v-model="v.angle" max="360" />
> Angle: {{ v.angle }}°
> Radius: 100

> Cartesian coordinates:
> {{ pol2car(v.angle,100) }}
```

<svg width="400" height="400">
  <g transform="translate(200,200)">
    <circle r="100" fill="none" stroke="black" />
    <circle :cx="pol2car(v.angle,100).x" :cy="pol2car(v.angle,100).y" r="10" />
  </g>
</svg>

> Polar coordinates:
> <v-slider v-model="v.angle" max="360" />
> angle: {{ v.angle }}
> radius: 100

> Cartesian coordinates:
> {{ pol2car(v.angle,100) }}

## car2pol

Converts Cartesian coordinates to polar coordinates. Inspired by [cart2pol()](https://rdrr.io/github/jaredlander/useful/man/cart2pol.html) function in R and Matlab.

```ts
function car2pol(
  angle: number = 0,
  radius: number = 0
): { x: number; y: number };
```

> Cartesian coordinates
> <v-slider v-model="v.x" max="400" />
> v.x: {{ v.x }} <v-slider v-model="v.y" max="400" />
> v.y: {{ v.y }}

> Polar coordinates:
> {{ car2pol(v.x,v.y) }}

## deg2rad

Converts degrees to radians

```ts
function deg2rad(deg: number): number;
```

#### Usage

```md
> <v-slider v-model="v.deg" max="360" />
> Degrees: {{ v.deg }}

> Radians {{ deg2rad(v.deg) }} = {{ deg2rad(v.deg) / Math.PI }} π
```

> <v-slider v-model="v.deg" max="360" />
> Degrees: {{ v.deg }}

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
> Degrees: {{ rad2deg(v.rad) }}
```

<v-slider v-model="v.rad" :max="2 * Math.PI" step="any" />
> Radians {{ v.rad }} = {{ v.rad / Math.PI }} π
> Degrees: {{ rad2deg(v.rad) }}

#### See also

https://designstem.github.io/fachwerk/docs/#/deg2rad

https://visualia.github.io/visualia_original/#helper-functions_trigonometry

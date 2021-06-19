<script setup>
ref: x1 = 0
ref: y1 = 400
ref: x2 = 100
ref: y2 = 100
ref: x3 = 300
ref: y3 = 100
ref: x4 = 400
ref: y4 = 400
</script>

# SVG bezier curves

## Quadratic bezier curve

```md
<path :d="bezier(0,400,100,100,400,400)" stroke="black" stroke-width="2" fill="none" />
```

<svg width="400" height="400">
  <line :x1="x1" :y1="y1" :x2="x2" :y2="y2" stroke="#aaa" />
  <line :x1="x2" :y1="y2" :x2="x4" :y2="y4" stroke="#aaa" />
  <path :d="bezier(x1,y1,x2,y2,x4,y4)" stroke="black" stroke-width="2" fill="none" />
  <circle :cx="x2" :cy="y2" r="10" />
</svg>

## Cubic bezier curve

```md
<path :d="bezier(0,400,100,100,300,100,400,400)" stroke="black" stroke-width="2" fill="none" />
```

<svg width="400" height="400">
  <line :x1="x1" :y1="y1" :x2="x2" :y2="y2" stroke="#aaa" />
  <line :x1="x3" :y1="y3" :x2="x4" :y2="y4" stroke="#aaa" />
  <path :d="bezier(x1,y1,x2,y2,x3,y3, x4,y4)" stroke="black" stroke-width="2" fill="none" />
  <circle :cx="x2" :cy="y2" r="10" />
  <circle :cx="x3" :cy="y3" r="10" />
</svg>

#### See also

https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#b%C3%A9zier_curves

https://www.joshwcomeau.com/animation/dynamic-bezier-curves/

http://jamie-wong.com/post/bezier-curves/

https://pomax.github.io/bezierinfo/

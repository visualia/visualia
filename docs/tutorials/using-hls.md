# Using HSL Colors In CSS

<v-svg width="200" height="200">
  <circle v-for="g in hexgrid(10,10,20,true)" :cx="g.x" :cy="g.y" :r="v.a" opacity="0.1" />
</v-svg>

<v-slider v-model="v.a" max="200" />

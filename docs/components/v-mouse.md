<script setup>
  import { onMounted, computed } from 'vue'
  import { useMouseInElement } from "@vueuse/core"
  ref: svg = null
  ref: x1 = 0
  ref: y1 = 400
  ref: x2 = 400
  ref: y2 = 0
  ref: mouse = { elementX: 0, elementY: 0}
  onMounted(() => mouse = useMouseInElement(svg))
</script>

{{ x2 }} {{ y2 }}

<svg ref="svg" width="400" height="400" style="border: 1px solid red">
  <line :x1="x1" :y1="y1" :x2="mouse.elementX" :y2="mouse.elementY" stroke="#aaa" />
  <path :d="bezier(x1,y1,mouse.elementX,mouse.elementY,x2,y2)" stroke="black" stroke-width="2" fill="none" />
  <circle :cx="mouse.elementX" :cy="mouse.elementY" r="10" />
</svg>

<!--
<path :d="bezier(x1,y1,mouse.elementX,mouse.elementy,x2,y2)" stroke="black" stroke-width="2" fill="none" />
<v-mouse>
  <svg width="400" height="400">
    <path :d="bezier(100,200,v.p1?.x || 100,v.p1?.y || 100,v.p2?.x || 300,v.p2?.y || 100, 300,200)" stroke="black" stroke-width="2" fill="none" />
    <line :x1="100" :y1="200" :x2="v.p1?.x || 100" :y2="v.p1?.y || 100" stroke="#ccc" />
    <line :x1="300" :y1="200" :x2="v.p2?.x || 300" :y2="v.p2?.y || 100" stroke="#ccc" />
    <circle cx="100" cy="200" r="6" />
    <circle cx="300" cy="200" r="6"  />
     <circle
      :cx="v.p1?.x || 100"
      :cy="v.p1?.y || 100"
      :r="8"
      v-on:mousedown="v.p1move = true"
      v-on:mouseup="v.p1move = false"
      fill="red"
    />
    <circle
      :cx="v.p2?.x || 300"
      :cy="v.p2?.y || 100"
      :r="8"
      v-on:mousedown="v.p2move = true"
      v-on:mouseup="v.p2move = false"
      fill="red"
    />
  </svg>
</v-mouse>

{{ bezier(100,200,v.p1?.x || 100,v.p1?.y || 100,v.p2?.x || 300,v.p2?.y || 100, 300,200) }}
{{ set('p1', v.mouse?.pressed && v.p1move ? v.mouse : v.p1) }}

{{ set('p2', v.mouse?.pressed && v.p2move ? v.mouse : v.p2) }}

{{ v.p1 }}

{{ v.p2 }}

-->

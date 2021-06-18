# v-mouse

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

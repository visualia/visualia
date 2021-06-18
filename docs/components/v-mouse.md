# v-mouse

<!-- <v-mouse style="border: 1px solid black">
  <svg width="100" height="100">
    <circle v-if="get('mouse') && !get('mouse').outside" :cx="get('mouse').x" :cy="get('mouse').y" r="10" :fill="get('mouse').pressed ? 'red' : 'black'" />
  </svg>
</v-mouse>

{{ get("mouse") }} -->

<v-mouse style="border: 1px solid black">
  <svg width="400" height="400">
    <circle
      :cx="v.p1?.x"
      :cy="v.p1?.y"
      :r="10"
      v-on:mousedown="v.p1move = true"
      v-on:mouseup="v.p1move = false"
    />
  </svg>
</v-mouse>

{{ set('p1', v.mouse?.pressed && v.p1move ? v.mouse : v.p1) }}

{{ v.p1 }}
`

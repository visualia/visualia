# v-mouse

`<v-mouse>` allow to receive current mouse coordinates plus a button press status. It also works with a pointer devices.

#### Global mouse data

```md
<v-mouse v-model="ref.mouse" />

> {{ ref.mouse }}
```

<v-mouse v-model="ref.mouse" />

> {{ ref.mouse }}

#### Element mouse data

```md
<v-mouse v-model="ref.svgmouse">
  <svg width="200" height="200" style="background: #eee">
    <circle :cx="ref.svgmouse?.x" :cy="ref.svgmouse?.y" r="10" fill="red" />
  </svg>
</v-mouse>

> {{ ref.svgmouse }}
```

<v-mouse v-model="ref.svgmouse">
  <svg width="200" height="200" style="background: #eee">
    <circle :cx="ref.svgmouse?.x" :cy="ref.svgmouse?.y" r="10" fill="red" />
  </svg>
</v-mouse>

> {{ ref.svgmouse }}

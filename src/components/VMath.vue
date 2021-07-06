<script setup lang="ts">
import { ref, useSlots, watch } from "vue";
import { renderToString } from "katex";
import { ClientOnly } from "../lib";
import "katex/dist/katex.css";

const math = ref("");
const slots = useSlots();

if (slots && slots.default) {
  watch(
    () => slots.default!(),
    (nodes) => {
      const node = nodes[0].children;
      math.value = renderToString(String.raw`${node}`, {
        throwOnError: false,
      });
    },
    { immediate: true }
  );
}
</script>

<template>
  <client-only><span v-if="math" v-html="math" /></client-only>
</template>

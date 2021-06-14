<script setup lang="ts">
import { inject } from "vue";
const state = inject("state") as any;
</script>

<template><input type="range" v-model="state.x" /> {{ state.x }}</template>

<script setup>
import { ref } from "vue";
const b = ref(0);
</script>

<template><input type="range" v-model="b" /> b: {{ b }} ></template>

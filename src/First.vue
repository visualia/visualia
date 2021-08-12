<script setup>
import { ref } from "vue";
const a = ref(0);
</script>

<template><input type="range" v-model="a" /> {{ a }} ></template>

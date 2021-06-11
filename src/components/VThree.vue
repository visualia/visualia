<script setup>
import { ref, onMounted, onBeforeUpdate, provide, watch } from "vue";
import { useRafFn } from "@vueuse/core";

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  CircleGeometry,
  MeshNormalMaterial,
  Mesh,
  Group,
} from "three";

import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const el = ref(null);
const width = 400;
const height = 400;

const interacting = ref(false);

const scene = new Scene();
provide("scene", scene);

const camera = new PerspectiveCamera(75, width / height, 1, 1100);
camera.position.z = 3;

const renderer = new SVGRenderer();
//const renderer = new WebGLRenderer({ alpha: true, antialias: true });
//renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);

const update = () => {
  //controls.update();
  renderer.render(scene, camera);
};

//@ts-ignore
const controls = new OrbitControls(camera, renderer.domElement);

controls.addEventListener("start", () => (interacting.value = true));
controls.addEventListener("end", () => (interacting.value = false));
controls.addEventListener("change", update);

onMounted(() => {
  //@ts-ignore
  el.value.append(renderer.domElement);
  update();
});

onBeforeUpdate(() => {
  update();
});

//useRafFn(update);
</script>

<template>
  <div ref="el" :style="{ cursor: interacting ? 'grabbing' : 'grab' }">
    <slot />
  </div>
</template>

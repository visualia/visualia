<script setup lang="ts">
import { defineProps, inject } from "vue";
import { Scene, MeshNormalMaterial, Mesh } from "three";
import * as THREE from "three";

// const a = Object.keys(THREE)
//   .filter((k) => k.endsWith("Geometry"))
//   .map((k) => `THREE.${k}`)
//   .join(" | ");

// const b = Object.keys(THREE)
//   .filter((k) => k.endsWith("Geometry"))
//   .map((k) => `"${k}"`)
//   .join(" | ");

type Geometry =
  | THREE.BoxBufferGeometry
  | THREE.BoxGeometry
  | THREE.BufferGeometry
  | THREE.CircleBufferGeometry
  | THREE.CircleGeometry
  | THREE.ConeBufferGeometry
  | THREE.ConeGeometry
  | THREE.CylinderBufferGeometry
  | THREE.CylinderGeometry
  | THREE.DodecahedronBufferGeometry
  | THREE.DodecahedronGeometry
  | THREE.EdgesGeometry
  | THREE.ExtrudeBufferGeometry
  | THREE.ExtrudeGeometry
  | THREE.IcosahedronBufferGeometry
  | THREE.IcosahedronGeometry
  | THREE.InstancedBufferGeometry
  | THREE.LatheBufferGeometry
  | THREE.LatheGeometry
  | THREE.OctahedronBufferGeometry
  | THREE.OctahedronGeometry
  | THREE.ParametricBufferGeometry
  | THREE.ParametricGeometry
  | THREE.PlaneBufferGeometry
  | THREE.PlaneGeometry
  | THREE.PolyhedronBufferGeometry
  | THREE.PolyhedronGeometry
  | THREE.RingBufferGeometry
  | THREE.RingGeometry
  | THREE.ShapeBufferGeometry
  | THREE.ShapeGeometry
  | THREE.SphereBufferGeometry
  | THREE.SphereGeometry
  | THREE.TetrahedronBufferGeometry
  | THREE.TetrahedronGeometry
  | THREE.TextBufferGeometry
  | THREE.TextGeometry
  | THREE.TorusBufferGeometry
  | THREE.TorusGeometry
  | THREE.TorusKnotBufferGeometry
  | THREE.TorusKnotGeometry
  | THREE.TubeBufferGeometry
  | THREE.TubeGeometry
  | THREE.WireframeGeometry;

type GeometryType =
  | "BoxBufferGeometry"
  | "BoxGeometry"
  | "BufferGeometry"
  | "CircleBufferGeometry"
  | "CircleGeometry"
  | "ConeBufferGeometry"
  | "ConeGeometry"
  | "CylinderBufferGeometry"
  | "CylinderGeometry"
  | "DodecahedronBufferGeometry"
  | "DodecahedronGeometry"
  | "EdgesGeometry"
  | "ExtrudeBufferGeometry"
  | "ExtrudeGeometry"
  | "IcosahedronBufferGeometry"
  | "IcosahedronGeometry"
  | "InstancedBufferGeometry"
  | "LatheBufferGeometry"
  | "LatheGeometry"
  | "OctahedronBufferGeometry"
  | "OctahedronGeometry"
  | "ParametricBufferGeometry"
  | "ParametricGeometry"
  | "PlaneBufferGeometry"
  | "PlaneGeometry"
  | "PolyhedronBufferGeometry"
  | "PolyhedronGeometry"
  | "RingBufferGeometry"
  | "RingGeometry"
  | "ShapeBufferGeometry"
  | "ShapeGeometry"
  | "SphereBufferGeometry"
  | "SphereGeometry"
  | "TetrahedronBufferGeometry"
  | "TetrahedronGeometry"
  | "TextBufferGeometry"
  | "TextGeometry"
  | "TorusBufferGeometry"
  | "TorusGeometry"
  | "TorusKnotBufferGeometry"
  | "TorusKnotGeometry"
  | "TubeBufferGeometry"
  | "TubeGeometry"
  | "WireframeGeometry";
const props =
  defineProps<{
    type?: GeometryType;
    args?: any[];
  }>();

const scene: Scene | undefined = inject("scene");

//@ts-ignore
const geometry: Geometry = new THREE[props.type || "BoxGeometry"](
  ...(props.args || [])
);
const material = new MeshNormalMaterial();
const obj = new Mesh(geometry, material);

if (scene) {
  scene.add(obj);
}
</script>

<template></template>

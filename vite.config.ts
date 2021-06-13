import path from "path";
import vue from "@vitejs/plugin-vue";
import dts from "vite-dts";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), dts()],
  resolve: { dedupe: ["vue"] },
  build: {
    lib: {
      entry: path.resolve(__dirname, "./src/index.ts"),
      name: "visualia",
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        sourcemapExcludeSources: true,
        globals: {
          vue: "Vue",
        },
      },
    },
    sourcemap: true,
    target: "esnext",
  },
});

import path from "path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    vue({
      script: {
        refSugar: true,
      },
    }),
  ],
  build: {
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "./src/index.ts"),
      name: "visualia",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        globals: {
          vue: "Vue",
        },
      },
    },
  },
});

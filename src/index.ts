import { Plugin, reactive } from "vue";
// import * as utils from "./utils";
// export { utils };
// export * from "./utils";

// //@TODO Property 'glob' does not exist on type 'ImportMeta'.
// //@ts-ignore
// const componentFiles: Record<string, ComponentOptions> = import.meta.globEager(
//   "./components/**/*.vue"
// );

// export const components = Object.fromEntries(
//   Object.entries(componentFiles).map(([path, component]) => {
//     return [
//       path.split("/").slice(-1)[0].replace(".vue", ""),
//       component.default,
//     ];
//   })
// );

// export const Visualia: Plugin = {
//   install: (app) => {
//     Object.entries(components).forEach(([name, component]) => {
//       app.component(name, component);
//     });
//     Object.entries(utils).forEach(
//       ([name, util]) => (app.config.globalProperties[name] = util)
//     );
//   },
// };

import VSlider from "./components/VSlider.vue";
import VAnimate from "./components/VAnimate.vue";

export const Visualia: Plugin = {
  install: (app) => {
    const state = reactive({}) as any;
    app.provide("state", state);
    app.component("VSlider", VSlider);
    app.component("VAnimate", VAnimate);

    app.config.globalProperties.get = (
      key: string,
      def?: string | number | boolean
    ): string | number | boolean | undefined => {
      return state?.[key] ?? def ?? undefined;
    };

    app.config.globalProperties.set = (
      key: string,
      value: string | number | boolean | null
    ): void => {
      state[key] = value;
    };
  },
};

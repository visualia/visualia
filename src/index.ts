import { Plugin, ComponentOptions } from "vue";
import * as components from "./components";
import * as utils from "./utils";

export * from "./components";
export * from "./utils";
export { components, utils };

export const Visualia: Plugin = {
  install: (app) => {
    Object.entries(components).forEach(([name, component]) => {
      app.component(name, component as ComponentOptions);
    });
    Object.entries(utils).forEach(
      ([name, util]) => (app.config.globalProperties[name] = util)
    );
  },
};

// import { reactive } from "vue";

// export { default as First } from "./First.vue";
// export { default as Second } from "./Second.vue";

// export const ab = reactive({ a: 0, b: 0 });

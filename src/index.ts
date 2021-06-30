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

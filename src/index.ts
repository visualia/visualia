import { Plugin, ComponentOptions, reactive, ref, createApp } from "vue";
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

export const v2 = reactive({});
export const v3 = ref(0);

export const useState = () => {
  let s = null;
  if (document) {
    const container = document.createElement("div");
    createApp({
      setup() {
        s = reactive({});
      },
      render: () => null,
    }).mount(container);
  }
};

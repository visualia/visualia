import { Plugin, reactive } from "vue";
import * as utils from "./utils";
export { utils };
export * from "./utils";

//@TODO Property 'glob' does not exist on type 'ImportMeta'.
//@ts-ignore
const componentFiles: Record<string, ComponentOptions> = import.meta.globEager(
  "./components/**/*.vue"
);

export const components = Object.fromEntries(
  Object.entries(componentFiles).map(([path, component]) => {
    return [
      path.split("/").slice(-1)[0].replace(".vue", ""),
      component.default,
    ];
  })
);

export const Visualia: Plugin = {
  install: (app) => {
    // Set up global state

    const state = <Record<string, any>>reactive({});
    app.provide("state", state);

    // Global state utilities
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

    // Load other utilities

    Object.entries(utils).forEach(
      ([name, util]) => (app.config.globalProperties[name] = util)
    );

    // Load components

    Object.entries(components).forEach(([name, component]) => {
      app.component(name, component);
    });
  },
};

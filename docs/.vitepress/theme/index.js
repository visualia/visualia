import { defineComponent, getCurrentInstance, h, watch } from "vue";
import { usePageData } from "vitepress";
import DefaultLayout from "vitepress/theme";
import { Visualia, utils } from "../../../src";

import "./index.css";

function visualiaLayout(component) {
  return defineComponent({
    setup() {
      const a = usePageData();
      Object.entries(a.value.frontmatter.data).forEach(([key, value]) => {
        utils.set(key, value);
      });
      // const instance = getCurrentInstance();
      // watch(
      //   utils.v,
      //   () => {
      //     Object.entries(utils.v).forEach(([key, value]) => {
      //       instance.appContext.config.globalProperties[key] = value;
      //       console.log(key, instance.appContext.config.globalProperties[key]);
      //     });
      //   },
      //   { immediate: true }
      // );
      return () => h(component);
    },
  });
}

export default {
  Layout: visualiaLayout(DefaultLayout.Layout),
  NotFound: DefaultLayout.NotFound,
  enhanceApp({ app }) {
    app.use(Visualia);
  },
};

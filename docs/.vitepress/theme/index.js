import { defineComponent, getCurrentInstance, h } from "vue";
import { usePageData } from "vitepress";
import DefaultLayout from "vitepress/theme";
import { Visualia, utils } from "../../../src";

import "./index.css";

function visualiaLayout(component) {
  return defineComponent({
    setup() {
      // const a = usePageData();
      // Object.entries(a.value.frontmatter.data).forEach(([key, value]) => {
      //   utils.set(key, value);
      // });
      const instance = getCurrentInstance();
      console.log(instance.appContext.config.globalProperties);
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

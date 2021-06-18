import { defineComponent, h } from "vue";
import { usePageData } from "vitepress";
import DefaultLayout from "vitepress/theme";
import { Visualia, utils } from "../../../src";

import "./index.css";

function setupVisualia(component) {
  return defineComponent({
    setup() {
      const a = usePageData();
      Object.entries(a.value.frontmatter.data).forEach(([key, value]) => {
        utils.set(key, value);
      });
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

import DefaultTheme from "vitepress/theme";
import { Visualia } from "../../../src";

import "./index.css";

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.use(Visualia);
  },
};

/**
 * @type {import('vitepress').UserConfig}
 */
module.exports = {
  title: "Visualia",
  markdown: { breaks: true },
  themeConfig: {
    repo: "visualia/visualia",
    sidebar: {
      "/": [
        {
          children: [{ text: "Getting started", link: "/" }],
        },
      ],
    },
  },
};

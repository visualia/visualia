/**
 * @type {import('vitepress').UserConfig}
 */
module.exports = {
  title: "Visualia",
  markdown: { breaks: true },
  themeConfig: {
    repo: "visualia/visualia",
    docsDir: "docs",
    prevLinks: false,
    nextLinks: false,
    editLinks: true,
    editLinkText: "Page source",
    sidebar: {
      "/": [
        {
          children: [
            { text: "Getting started", link: "/" },
            {
              text: "Components",
              children: ["slider", "math"].map((c) => ({
                text: `v-${c}`,
                link: `/components/v-${c}`,
              })),
            },
            {
              text: "Utilities",
              children: [
                { text: "Global variables", link: "/utils/variables" },
                { text: "Trig functions", link: "/utils/trig" },
                { text: "SVG paths", link: "/utils/svgpaths" },
                { text: "SVG transforms", link: "/utils/svgtransforms" },
              ],
            },
            { text: "Misc", link: "/misc" },
          ],
        },
      ],
    },
  },
};

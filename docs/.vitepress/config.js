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
            { text: "Getting started", link: "/getting-started" },
            {
              text: "Components",
              children: ["slider", "animate", "math"].map((c) => ({
                text: `v-${c}`,
                link: `/components/v-${c}`,
              })),
            },
            {
              text: "Utilities",
              children: [
                { text: "Global variables", link: "/utils/variables" },
                { text: "Trigonometry", link: "/utils/trig" },
                { text: "Arrays", link: "/utils/arrays" },
                { text: "Colors", link: "/utils/colors" },
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

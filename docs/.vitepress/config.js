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
            {
              text: "Getting started",
              children: [
                { text: "Introduction", link: "/introduction" },
                { text: "Installation", link: "/installation" },
              ],
            },
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
                { text: "Global events", link: "/utils/events" },
                { text: "Trigonometry", link: "/utils/trig" },
                { text: "Random", link: "/utils/random" },
                { text: "Arrays", link: "/utils/arrays" },
                { text: "Colors", link: "/utils/colors" },
                { text: "SVG arc", link: "/utils/arc" },
                { text: "SVG beziers", link: "/utils/beziers" },
                { text: "SVG transforms", link: "/utils/transforms" },
              ],
            },
            { text: "Integrations", link: "/integrations" },
          ],
        },
      ],
    },
  },
};

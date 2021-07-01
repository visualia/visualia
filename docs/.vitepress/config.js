/**
 * @type {import('vitepress').UserConfig}
 */
module.exports = {
  title: "Visualia",
  markdown: { breaks: true },
  themeConfig: {
    repo: "visualia/visualia",
    docsDir: "docs",
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
                { text: "Variables", link: "/utils/variables" },
                { text: "Events", link: "/utils/events" },
                { text: "Arrays", link: "/utils/arrays" },
                { text: "Math", link: "/utils/math" },
                { text: "Trigonometry", link: "/utils/trig" },
                { text: "Random", link: "/utils/random" },
                { text: "Colors", link: "/utils/colors" },
                { text: "SVG arc", link: "/utils/arc" },
                { text: "SVG beziers", link: "/utils/beziers" },
                { text: "SVG transforms", link: "/utils/transforms" },
                { text: "SVG matrix", link: "/utils/matrix" },
              ],
            },
            { text: "Integrations", link: "/integrations" },
          ],
        },
      ],
    },
  },
};

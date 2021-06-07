/**
 * @type {import('vitepress').UserConfig}
 */
module.exports = {
  title: "Visualia",
  markdown: { breaks: true },
  themeConfig: {
    repo: "visualia/visualia",
    prevLinks: false,
    nextLinks: false,
    editLinks: true,
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
            //{ text: "Components", link: "/components" },
          ],
        },
      ],
    },
  },
};

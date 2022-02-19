// @ts-check

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Middy.js',
  tagline: 'The stylish Node.js middleware engine for AWS Lambda',
  url: 'https://middy.js.org',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.svg',
  organizationName: 'middyjs',
  projectName: 'middy',

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl: 'https://github.com/middyjs/middy/tree/main/website/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Middy',
        logo: {
          alt: 'Middy Logo',
          src: 'img/middy-logo-small.svg',
        },
        items: [
          {
            type: 'doc',
            docId: 'intro/intro',
            position: 'left',
            label: 'Documentation',
          },
          {
            type: 'doc',
            docId: 'middlewares/intro',
            position: 'left',
            label: 'Middlewares',
          },
          {
            type: 'doc',
            docId: 'events/intro',
            position: 'left',
            label: 'AWS Events',
          },
          {
            href: 'https://github.com/middyjs/middy',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Documentation',
                to: '/docs/intro/intro',
              },
              {
                label: 'Middlewares',
                to: '/docs/category/middlewares',
              },
            ],
          },
          {
            title: 'Community & support',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/facebook/docusaurus',
              },
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/middy?sort=Newest&uqlId=35052',
              },
              {
                label: 'Gitter',
                href: 'https://gitter.im/middyjs/Lobby',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'npm',
                href: 'https://www.npmjs.com/package/@middy/core',
              },
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Middy - Built with Docusaurus. - Icons by feathericons.com`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;

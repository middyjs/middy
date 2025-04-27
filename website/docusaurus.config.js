// @ts-check
const { themes } = require("prism-react-renderer");

const lightCodeTheme = themes.jettwaveLight;
const darkCodeTheme = themes.nightOwl;

/** @type {import('@docusaurus/types').Config} */
const config = {
	title: "Middy.js",
	tagline: "The stylish Node.js middleware engine for AWS Lambda",
	url: "https://middy.js.org",
	baseUrl: "/",
	onBrokenLinks: "throw",
	onBrokenMarkdownLinks: "warn",
	favicon: "img/favicon.svg",
	organizationName: "middyjs",
	projectName: "middy",

	plugins: [require.resolve("docusaurus-lunr-search")],

	presets: [
		[
			"classic",
			/** @type {import('@docusaurus/preset-classic').Options} */
			({
				docs: {
					sidebarCollapsible: true,
					showLastUpdateTime: true,
					sidebarPath: require.resolve("./sidebars.js"),
					// Please change this to your repo.
					editUrl: "https://github.com/middyjs/middy/tree/main/website/",
					remarkPlugins: [
						[require("@docusaurus/remark-plugin-npm2yarn"), { sync: true }],
					],
				},
				pages: {
					remarkPlugins: [require("@docusaurus/remark-plugin-npm2yarn")],
				},
				theme: {
					customCss: require.resolve("./src/css/custom.css"),
				},
			}),
		],
	],

	themeConfig:
		/** @type {import('@docusaurus/preset-classic').ThemeConfig} */
		({
			navbar: {
				title: "Middy",
				logo: {
					alt: "Middy Logo",
					src: "img/middy-logo-small.svg",
				},
				items: [
					{
						type: "doc",
						docId: "intro/intro",
						position: "left",
						label: "Documentation",
					},
					{
						type: "doc",
						docId: "middlewares/intro",
						position: "left",
						label: "Middlewares",
					},
					{
						type: "doc",
						docId: "events/intro",
						position: "left",
						label: "AWS Events",
					},
					{
						href: "https://github.com/middyjs/middy",
						label: "GitHub",
						position: "right",
					},
				],
			},
			footer: {
				style: "dark",
				links: [
					{
						title: "Docs",
						items: [
							{
								label: "Documentation",
								to: "/docs",
							},
							{
								label: "Middlewares",
								to: "/docs/category/middlewares",
							},
							{
								label: "AWS Events",
								to: "/docs/events/intro",
							},
						],
					},
					{
						title: "Community & support",
						items: [
							{
								label: "GitHub",
								href: "https://github.com/middyjs/middy",
							},
							{
								label: "Stack Overflow",
								href: "https://stackoverflow.com/questions/tagged/middy?sort=Newest&uqlId=35052",
							},
							{
								label: "Gitter",
								href: "https://gitter.im/middyjs/Lobby",
							},
						],
					},
					{
						title: "More",
						items: [
							{
								label: "npm",
								href: "https://www.npmjs.com/package/@middy/core",
							},
						],
					},
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

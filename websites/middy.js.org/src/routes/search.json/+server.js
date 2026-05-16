import { getDocsFiles, getDocsRoutes } from "$lib/docs-content.js";

export const prerender = true;

const SITE = "https://middy.js.org";

const FRONTMATTER_RE = /^---\s*\n[\s\S]*?\n---\s*\n?/;
const SCRIPT_BLOCK_RE = /<script\b[\s\S]*?<\/script>\s*/gi;
const STYLE_BLOCK_RE = /<style\b[\s\S]*?<\/style>\s*/gi;
const SVELTE_TAG_RE = /<\/?([A-Z][A-Za-z0-9]*)(?:\s[^>]*)?>\s*/g;
const CODE_FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`]+`/g;
const MD_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
const MD_EMPHASIS_RE = /[*_]{1,2}([^*_\n]+)[*_]{1,2}/g;
const HEADING_RE = /^\s*#{1,6}\s+/gm;
const LIST_RE = /^\s*[-*+]\s+/gm;
const WHITESPACE_RE = /\s+/g;

const stripUntilStable = (str, regexes) => {
	let prev;
	do {
		prev = str;
		for (const re of regexes) str = str.replace(re, "");
	} while (str !== prev);
	return str;
};

const excerpt = (raw, maxLength = 280) => {
	let body = raw.replace(FRONTMATTER_RE, "");
	body = stripUntilStable(body, [
		SCRIPT_BLOCK_RE,
		STYLE_BLOCK_RE,
		SVELTE_TAG_RE,
	]);
	body = body
		.replace(CODE_FENCE_RE, "")
		.replace(INLINE_CODE_RE, "")
		.replace(MD_LINK_RE, "$1")
		.replace(MD_EMPHASIS_RE, "$1")
		.replace(HEADING_RE, "")
		.replace(LIST_RE, "")
		.replace(WHITESPACE_RE, " ")
		.trim();
	if (body.length <= maxLength) return body;
	return `${body.slice(0, maxLength - 1).trimEnd()}…`;
};

export const GET = () => {
	const routes = getDocsRoutes();
	const filesByHref = new Map();
	for (const file of getDocsFiles()) {
		const href =
			`/docs/${file.filePath.replace(/\/?\+page\.md$/, "")}`.replace(
				/\/$/,
				"",
			) || "/docs";
		filesByHref.set(href, file.content);
	}

	const entries = routes.map((route) => {
		const url = `${SITE}${route.href}`;
		const content = filesByHref.get(route.href) ?? "";
		return {
			id: route.href.replace(/^\/?docs\/?/, "").replace(/\//g, "-") || "home",
			title: route.title,
			description: route.description,
			href: route.href,
			url,
			excerpt: excerpt(content),
		};
	});

	return new Response(
		JSON.stringify(
			{
				name: "Middy.js",
				url: SITE,
				updatedAt: new Date().toISOString(),
				count: entries.length,
				entries,
			},
			null,
			2,
		),
		{
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=3600",
			},
		},
	);
};

import { getDocsFiles } from "$lib/docs-content.js";

export const prerender = true;

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const SCRIPT_BLOCK_RE = /<script\b[\s\S]*?<\/script>\s*/gi;
const SCRIPT_MODULE_RE = /<script\s+module\b[\s\S]*?<\/script>\s*/gi;
const STYLE_BLOCK_RE = /<style\b[\s\S]*?<\/style>\s*/gi;
const SVELTE_TAG_RE = /<\/?([A-Z][A-Za-z0-9]*)(?:\s[^>]*)?>\s*/g;
const BLANK_LINES_RE = /\n{3,}/g;

const stripUntilStable = (str, regexes) => {
	let prev;
	do {
		prev = str;
		for (const re of regexes) str = str.replace(re, "");
	} while (str !== prev);
	return str;
};

const cleanContent = (raw) => {
	const fmMatch = raw.match(FRONTMATTER_RE);
	let title = "";
	let description = "";
	if (fmMatch) {
		for (const line of fmMatch[1].split("\n")) {
			const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
			if (!m) continue;
			let value = m[2].trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			if (m[1] === "title") title = value;
			else if (m[1] === "description") description = value;
		}
	}

	let body = raw.replace(FRONTMATTER_RE, "");
	body = stripUntilStable(body, [
		SCRIPT_MODULE_RE,
		SCRIPT_BLOCK_RE,
		STYLE_BLOCK_RE,
		SVELTE_TAG_RE,
	]);
	body = body.replace(BLANK_LINES_RE, "\n\n").trim();

	return { title, description, body };
};

export const GET = () => {
	const files = getDocsFiles();
	const parts = [
		"# Middy.js Documentation",
		"",
		"> The stylish Node.js middleware engine for AWS Lambda.",
		"",
		"This document is the full Middy documentation concatenated as plain Markdown for use by language models and other automated readers. The human-readable version lives at https://middy.js.org/docs.",
		"",
	];

	for (const { filePath, content } of files) {
		const { title, description, body } = cleanContent(content);
		const heading = title || filePath;
		parts.push("---");
		parts.push("");
		parts.push(`## ${heading}`);
		parts.push("");
		parts.push(
			`Path: /docs/${filePath.replace(/\/\+page\.md$/, "").replace(/^\+page\.md$/, "")}`,
		);
		if (description) {
			parts.push(`Summary: ${description}`);
		}
		parts.push("");
		parts.push(body);
		parts.push("");
	}

	return new Response(parts.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

// Search helpers for the /search page. Kept free of Vite-only imports so the
// index build and query logic can run under node:test.

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const TITLE_RE = /^title:\s*(.+)$/m;
const HEADING1_RE = /^#\s+(.+)$/m;
const QUOTED_RE = /^(["'])(.*)\1$/;
const SCRIPT_BLOCK_RE = /<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi;
const STYLE_BLOCK_RE = /<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi;
const CODE_FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`]+`/g;
const HEADING_RE = /^\s*#{1,6}\s+/gm;
const MD_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
const MD_EMPHASIS_RE = /[*_]{1,2}([^*_]+)[*_]{1,2}/g;
const LIST_RE = /^\s*[-*+]\s+/gm;
const WHITESPACE_RE = /\s+/g;
const REGEXP_SPECIAL_RE = /[.*+?^${}()|[\]\\]/g;
const PAGE_FILE_RE = /\/?\+page\.md$/;

export function extractTitle(content) {
	const frontmatter = content.match(FRONTMATTER_RE)?.[1] ?? "";
	const title =
		frontmatter.match(TITLE_RE)?.[1] ?? content.match(HEADING1_RE)?.[1];
	if (!title) return "Untitled";
	return title.trim().replace(QUOTED_RE, "$2");
}

export function cleanContentForSearch(content) {
	return content
		.replace(FRONTMATTER_RE, "")
		.replace(SCRIPT_BLOCK_RE, "")
		.replace(STYLE_BLOCK_RE, "")
		.replace(CODE_FENCE_RE, "")
		.replace(INLINE_CODE_RE, "")
		.replace(HEADING_RE, "")
		.replace(MD_LINK_RE, "$1")
		.replace(MD_EMPHASIS_RE, "$1")
		.replace(LIST_RE, "")
		.replace(WHITESPACE_RE, " ")
		.trim();
}

// files: [{ filePath, content }] relative to src/routes/docs
export function buildSearchIndex(files) {
	return files.map(({ filePath, content }) => {
		const relativePath = filePath.replace(PAGE_FILE_RE, "");
		return {
			id: relativePath.replace(/\//g, "-") || "home",
			href: relativePath ? `/docs/${relativePath}` : "/docs",
			title: extractTitle(content),
			text: cleanContentForSearch(content),
		};
	});
}

export function escapeRegExp(value) {
	return value.replace(REGEXP_SPECIAL_RE, "\\$&");
}

// Splits text into [{ text, match }] so the template can wrap matches in
// <mark> while Svelte escapes every segment; no HTML string is built here.
export function highlightSegments(text, matcher) {
	const segments = [];
	let cursor = 0;
	for (const found of text.matchAll(matcher)) {
		if (found.index > cursor) {
			segments.push({ text: text.slice(cursor, found.index), match: false });
		}
		segments.push({ text: found[0], match: true });
		cursor = found.index + found[0].length;
	}
	if (cursor < text.length) {
		segments.push({ text: text.slice(cursor), match: false });
	}
	return segments;
}

function snippetAround(text, position, maxLength) {
	const start = Math.max(0, position - Math.floor(maxLength / 2));
	const end = Math.min(text.length, start + maxLength);
	let snippet = text.slice(start, end);
	if (start > 0) snippet = `...${snippet}`;
	if (end < text.length) snippet = `${snippet}...`;
	return snippet;
}

export function searchIndex(
	index,
	query,
	{ maxResults = 10, snippetLength = 150 } = {},
) {
	const results = [];
	const needle = query.trim();
	if (!needle) return results;
	// Escaped literal, so the pattern is linear and safe for user input.
	const matcher = new RegExp(escapeRegExp(needle), "gi");
	for (const entry of index) {
		if (results.length >= maxResults) break;
		const position = entry.text.search(matcher);
		if (position === -1) continue;
		results.push({
			id: entry.id,
			href: entry.href,
			title: entry.title,
			description: highlightSegments(
				snippetAround(entry.text, position, snippetLength),
				matcher,
			),
		});
	}
	return results;
}

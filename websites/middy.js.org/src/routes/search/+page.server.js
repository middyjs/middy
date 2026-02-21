import pkg from "../../../package.json" with { type: "json" };

const hostname = pkg.name;

function extractTitle(content) {
	// Try to extract title from frontmatter
	const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (frontmatterMatch) {
		const titleMatch = frontmatterMatch[1].match(/title:\s*(.+)/);
		if (titleMatch) {
			return titleMatch[1].trim();
		}
	}

	// Fallback to first # heading
	const headingMatch = content.match(/^#\s+(.+)$/m);
	if (headingMatch) {
		return headingMatch[1].trim();
	}

	return "Untitled";
}

function parseLlmsTxt(llmsContent) {
	const files = [];
	// Split by the file separator pattern: \n\n// File:
	const parts = llmsContent.split(/\n\n\/\/ File: /);

	// Skip the first part (it's before the first file marker)
	for (let i = 1; i < parts.length; i++) {
		const block = parts[i];
		if (!block.trim()) continue;

		// The format is: "path/to/file.md\n\nactual content here"
		// First line is the file path, then \n\n, then content
		const lines = block.split("\n");
		if (lines.length < 3) continue;

		const filePath = lines[0].trim();
		// Skip the empty line and join the rest as content
		const content = lines.slice(2).join("\n").trim();

		if (filePath && content) {
			files.push({ filePath, content });
		}
	}

	return files;
}

function cleanContentForSearch(content) {
	// Remove frontmatter
	const withoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");

	// Remove markdown syntax for cleaner search
	return withoutFrontmatter
		.replace(/```[\s\S]*?```/g, "") // Remove code blocks
		.replace(/`[^`]+`/g, "") // Remove inline code
		.replace(/^\s*#{1,6}\s+/gm, "") // Remove headings
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
		.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1") // Remove bold/italic
		.replace(/^\s*[-*+]\s+/gm, "") // Remove list markers
		.replace(/\n\s*\n/g, " ") // Collapse multiple newlines
		.replace(/\s+/g, " ") // Normalize whitespace
		.trim();
}

function searchContent(content, query) {
	const cleanContent = cleanContentForSearch(content);
	const lowerContent = cleanContent.toLowerCase();
	const lowerQuery = query.toLowerCase();

	// Search only in readable content (not code blocks, frontmatter, etc.)
	return lowerContent.includes(lowerQuery);
}

function extractDescription(content, query, maxLength = 150) {
	// Validate query to prevent ReDoS attacks
	if (!query || query.length > 100 || query.length < 1) {
		return null;
	}

	// Reject queries with excessive repetition (potential ReDoS pattern)
	if (/(.)\1{20,}/.test(query)) {
		return null;
	}

	const cleanContent = cleanContentForSearch(content);

	// Find the position of the query in the clean content
	const lowerCleanContent = cleanContent.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const queryIndex = lowerCleanContent.indexOf(lowerQuery);

	if (queryIndex === -1) {
		// Query not found, return null
		return null;
	}

	// Calculate snippet bounds to center around the query
	const snippetStart = Math.max(0, queryIndex - Math.floor(maxLength / 2));
	const snippetEnd = Math.min(cleanContent.length, snippetStart + maxLength);

	let snippet = cleanContent.substring(snippetStart, snippetEnd);

	// Add ellipsis if needed
	if (snippetStart > 0) snippet = `...${snippet}`;
	if (snippetEnd < cleanContent.length) snippet = `${snippet}...`;

	// Bold the query match (case-insensitive) with safe regex handling
	try {
		const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		// SAST: Query is validated (max length, no excessive repetition) and properly escaped
		// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
		const regex = new RegExp(`(${escapedQuery})`, "gi");
		snippet = snippet.replace(regex, "<strong>$1</strong>");
	} catch (e) {
		// If regex fails, return snippet without highlighting (graceful degradation)
		console.warn("Search highlighting failed:", e.message);
	}

	return snippet;
}

let llmsContent;
export async function load({ url, fetch }) {
	const query = url.searchParams.get("q");

	if (!query || query.trim() === "") {
		return {
			results: [],
			query: "",
		};
	}

	try {
		// Get llms.txt content using the imported GET function
		llmsContent ??= await fetch(`https://${hostname}/llms.txt`).then((res) =>
			res.text(),
		);

		const files = parseLlmsTxt(llmsContent);

		const results = [];
		const maxResults = 10;

		for (const { filePath, content } of files) {
			// Stop if we've reached the max number of results
			if (results.length >= maxResults) break;

			// Check if query matches content
			if (searchContent(content, query)) {
				// Convert file path to href
				const relativePath = filePath
					.replace(/\+page\.md$/, "")
					.replace(/^\//, "");

				const href = `/docs/${relativePath}`;
				const title = extractTitle(content);
				const description = extractDescription(content, query);
				const id = relativePath.replace(/\//g, "-") || "home";

				results.push({
					id,
					href,
					title,
					description,
				});
			}
		}

		return {
			results,
			query: query.trim(),
		};
	} catch (error) {
		console.error("Error searching:", error);
		return {
			results: [],
			query: query.trim(),
			error: error.message,
		};
	}
}

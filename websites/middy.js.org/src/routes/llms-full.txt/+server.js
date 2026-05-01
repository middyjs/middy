import { getDocsFiles } from "$lib/docs-content.js";

export const prerender = true;

export const GET = () => {
	const files = getDocsFiles();
	const contents = ["# Middy.js Documentation\n"];

	for (const { filePath, content } of files) {
		contents.push(`\n\n// File: ${filePath}\n\n`);
		contents.push(content);
	}

	return new Response(contents.join(""), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

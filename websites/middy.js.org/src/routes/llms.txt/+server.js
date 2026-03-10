import { getDocsFiles } from "$lib/docs-content.js";

export const prerender = true;

export const GET = () => {
	const files = getDocsFiles();
	const contents = [];

	for (const { filePath, content } of files) {
		contents.push(`\n\n// File: ${filePath}\n\n`);
		contents.push(content);
	}

	const finalContent = contents.join("");

	return new Response(finalContent, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

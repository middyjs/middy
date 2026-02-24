import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const prerender = true;

async function getMarkdownFiles(dir, fileList = []) {
	const files = await readdir(dir, { withFileTypes: true });

	for (const file of files) {
		const filePath = join(dir, file.name);

		if (file.isDirectory()) {
			await getMarkdownFiles(filePath, fileList);
		} else if (file.name.endsWith(".md")) {
			fileList.push(filePath);
		}
	}

	return fileList;
}

export const GET = async () => {
	try {
		const docsDir = join(process.cwd(), "src", "routes", "docs");
		const markdownFiles = await getMarkdownFiles(docsDir);

		// Sort files for consistent output
		markdownFiles.sort();

		const contents = [];

		for (const filePath of markdownFiles) {
			const content = await readFile(filePath, "utf-8");
			const relativePath = filePath.replace(docsDir, "").replace(/^\//, "");

			// Add separator with file path
			contents.push(`\n\n// File: ${relativePath}\n\n`);
			contents.push(content);
		}

		const finalContent = contents.join("");

		return new Response(finalContent, {
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch (error) {
		return new Response(`Error generating llms.txt: ${error.message}`, {
			status: 500,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
			},
		});
	}
};

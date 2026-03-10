const modules = import.meta.glob("/src/routes/docs/**/+page.md", {
	query: "?raw",
	import: "default",
	eager: true,
});

export function getDocsFiles() {
	const files = [];
	for (const [key, content] of Object.entries(modules)) {
		const filePath = key.replace(/^\/src\/routes\/docs\//, "");
		files.push({ filePath, content });
	}
	files.sort((a, b) => a.filePath.localeCompare(b.filePath));
	return files;
}

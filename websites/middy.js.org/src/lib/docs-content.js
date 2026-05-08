const modules = import.meta.glob("/src/routes/docs/**/+page.md", {
	query: "?raw",
	import: "default",
	eager: true,
});

function parseFrontmatter(content) {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return {};
	const meta = {};
	for (const line of match[1].split("\n")) {
		const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
		if (!m) continue;
		let value = m[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		meta[m[1]] = value;
	}
	return meta;
}

function fileToHref(filePath) {
	const relative = filePath
		.replace(/^\/src\/routes\//, "/")
		.replace(/\/\+page\.md$/, "");
	return relative === "" ? "/" : relative;
}

export function getDocsFiles() {
	const files = [];
	for (const [key, content] of Object.entries(modules)) {
		const filePath = key.replace(/^\/src\/routes\/docs\//, "");
		files.push({ filePath, content });
	}
	files.sort((a, b) => a.filePath.localeCompare(b.filePath));
	return files;
}

export function getDocsRoutes() {
	const routes = [];
	for (const [key, content] of Object.entries(modules)) {
		const meta = parseFrontmatter(content);
		routes.push({
			href: fileToHref(key),
			title: meta.title ?? "Untitled",
			description: meta.description ?? "",
			position: meta.position ? Number(meta.position) : undefined,
		});
	}
	routes.sort((a, b) => a.href.localeCompare(b.href));
	return routes;
}

import { getDocsFiles } from "$lib/docs-content.js";
import { buildSearchIndex, searchIndex } from "$lib/search.js";

// Cleaned once per isolate at module load; a request only searches.
const index = buildSearchIndex(getDocsFiles());

export function load({ url }) {
	const query = url.searchParams.get("q")?.trim() ?? "";
	return {
		results: query ? searchIndex(index, query) : [],
		query,
	};
}

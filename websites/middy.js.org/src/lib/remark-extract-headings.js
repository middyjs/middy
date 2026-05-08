import { toString as nodetoString } from "mdast-util-to-string";
import visit from "unist-util-visit";

/**
 * Remark plugin to extract H2 headings and add them to frontmatter
 */
export function remarkExtractHeadings() {
	return (tree, file) => {
		const headings = [];

		visit(tree, "heading", (node) => {
			// Only extract H2 headings
			if (node.depth === 2) {
				const text = nodetoString(node);
				// Create slug from heading text
				const id = text
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "");

				headings.push({ id, text });
			}
		});

		// Add headings to frontmatter
		if (!file.data.fm) {
			file.data.fm = {};
		}
		file.data.fm.headings = headings;
	};
}

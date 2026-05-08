import { toString as nodetoString } from "hast-util-to-string";
import visit from "unist-util-visit";

/**
 * Rehype plugin to add IDs to H2 headings
 */
export function rehypeAddHeadingIds() {
	return (tree) => {
		visit(tree, "element", (node) => {
			// Only process H2 elements
			if (node.tagName === "h2") {
				const text = nodetoString(node);
				// Create slug from heading text
				const id = text
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "");

				// Add id to properties
				if (!node.properties) {
					node.properties = {};
				}
				node.properties.id = id;
			}
		});
	};
}

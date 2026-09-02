import visit from "unist-util-visit";

/**
 * Rehype plugin to add a copy button to code blocks.
 * mdsvex highlights fences before rehype runs, so they arrive as raw html.
 * The `language-*` class on `<pre>` is unused (the `<code>` keeps its own).
 */
export function rehypeCopyPre() {
	return (tree) => {
		visit(tree, "raw", (node) => {
			node.value = node.value.replace(
				/^<pre class="language-[^"]*"/,
				'<pre is="ds-copy-pre"',
			);
		});
	};
}

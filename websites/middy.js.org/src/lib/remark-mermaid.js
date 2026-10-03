import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import logos from "@iconify-json/logos/icons.json" with { type: "json" };
import { createMermaidRenderer } from "mermaid-isomorphic";
import { visit } from "unist-util-visit";

// Generated at build time, gitignored.
const dir = "static/diagrams";

// Labels are drawn after layout (see addIconLabels), so leave room for them.
const mermaidConfig = {
	theme: "neutral",
	flowchart: { nodeSpacing: 60, rankSpacing: 100 },
};

// Dark mode lives in the SVG so the <img> follows prefers-color-scheme. The label
// halo (stroke) matches the page background so edges crossing a label stay legible.
const css =
	".icon-label{font:16px arial,sans-serif;fill:#333;paint-order:stroke;stroke:#fff;stroke-width:6px;stroke-linejoin:round}@media (prefers-color-scheme: dark){.icon-label{fill:#e5e5e5;stroke:oklch(0.2393 0 0)}.flowchart-link{stroke:#a3a3a3!important}marker path{fill:#a3a3a3!important;stroke:#a3a3a3!important}}";

const iconLabel = /^(\s*(\w+)@\{[^}]*label: ")([^"]*)"/gm;

// Mermaid's icon shape anchors edges at the centre of icon+label, half a label
// below the icon's middle, with no config to change it (see `async function
// icon` in mermaid). So render icon-only nodes, whose edges meet the icon's
// middle, and draw each label under its icon afterwards.
const stripIconLabels = (source) => source.replaceAll(iconLabel, '$1"');

// ponytail: label width is estimated (~10px per char at 16px), not measured; only
// used to grow the viewBox so labels at the edges aren't clipped.
const addIconLabels = (svg, source) => {
	const labels = new Map(
		[...source.matchAll(iconLabel)].map((m) => [m[2], m[3]]),
	);
	let [minX, minY, maxX, maxY] = /viewBox="([^"]+)"/
		.exec(svg)[1]
		.split(" ")
		.map(Number);
	maxX += minX;
	maxY += minY;
	const out = svg.replace(
		/(<g class="icon-shape[^"]*" id="[^"]*-flowchart-(\w+)-\d+"[^>]*transform="translate\(([-\d.]+), ?([-\d.]+)\)">)/g,
		(tag, _, id, x, y) => {
			const text = labels.get(id);
			if (!text) return tag;
			const half = (text.length * 10) / 2;
			minX = Math.min(minX, Number(x) - half);
			maxX = Math.max(maxX, Number(x) + half);
			maxY = Math.max(maxY, Number(y) + 50);
			const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
			return `${tag}<text class="icon-label" y="44" text-anchor="middle">${escaped}</text>`;
		},
	);
	return out
		.replace(
			/viewBox="[^"]+"/,
			`viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}"`,
		)
		.replace(/max-width: [\d.]+px/, `max-width: ${maxX - minX}px`)
		.replace("</style>", `${css}</style>`);
};

// Uses the installed Chrome (preinstalled on GitHub's ubuntu runners), so no
// Playwright browser download.
const render = createMermaidRenderer({ launchOptions: { channel: "chrome" } });

/**
 * Remark plugin: ```mermaid fences -> <img> of a content-hashed SVG.
 * Runs before mdsvex highlighting (which turns fences into raw html).
 * The site CSP blocks inline <style>/style="", so the SVG can't be inlined.
 * Existing files are reused, so dev only re-renders changed diagrams.
 */
export function remarkMermaid() {
	return async (tree) => {
		const fences = [];
		visit(tree, "code", (node) => {
			if (node.lang !== "mermaid") return;
			const hash = createHash("sha256")
				.update(
					JSON.stringify(mermaidConfig) + css + addIconLabels + node.value,
				)
				.digest("hex")
				.slice(0, 16);
			fences.push({ node, file: `${hash}.svg` });
		});
		// One render call per page, so the browser launches once per page, not per diagram.
		const missing = fences.filter(
			({ file }) => !existsSync(resolve(dir, file)),
		);
		if (missing.length) {
			const results = await render(
				missing.map(({ node }) => stripIconLabels(node.value)),
				{ mermaidConfig, iconPacks: [{ name: "logos", icons: logos }] },
			);
			mkdirSync(dir, { recursive: true });
			for (const [i, result] of results.entries()) {
				if (result.status === "rejected") throw result.reason;
				writeFileSync(
					resolve(dir, missing[i].file),
					addIconLabels(result.value.svg, missing[i].node.value),
				);
			}
		}
		for (const { node, file } of fences) {
			const alt = /accDescr:\s*(.+)/.exec(node.value)?.[1].trim() ?? "";
			node.type = "html";
			node.value = `<img class="diagram" src="/diagrams/${file}" alt="${alt.replaceAll('"', "&quot;")}" loading="lazy">`;
		}
	};
}

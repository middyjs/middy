import { getDocsRoutes } from "$lib/docs-content.js";

export const prerender = true;

const SITE = "https://middy.js.org";

const SECTION_LABELS = {
	intro: "Introduction",
	middlewares: "Middlewares",
	routers: "Routers",
	events: "Events",
	"writing-middlewares": "Writing Middlewares",
	"best-practices": "Best Practices",
	"ecs-runners": "ECS Runners",
	integrations: "Integrations",
	upgrade: "Upgrade Guides",
	faq: "FAQ",
};

function sectionFor(href) {
	const segments = href
		.replace(/^\/docs\/?/, "")
		.split("/")
		.filter(Boolean);
	if (segments.length === 0) return "Overview";
	return SECTION_LABELS[segments[0]] ?? segments[0];
}

export const GET = () => {
	const routes = getDocsRoutes();
	const sections = new Map();

	for (const route of routes) {
		const section = sectionFor(route.href);
		if (!sections.has(section)) sections.set(section, []);
		sections.get(section).push(route);
	}

	const lines = [
		"# Middy.js",
		"",
		"> The stylish Node.js middleware engine for AWS Lambda. Organise your Lambda code, remove duplication, and focus on business logic.",
		"",
		`Full documentation as a single document: ${SITE}/llms-full.txt`,
		"",
	];

	for (const [section, items] of sections) {
		lines.push(`## ${section}`, "");
		for (const item of items) {
			const desc = item.description ? `: ${item.description}` : "";
			lines.push(`- [${item.title}](${SITE}${item.href})${desc}`);
		}
		lines.push("");
	}

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

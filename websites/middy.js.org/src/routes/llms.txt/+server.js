import { getDocsRoutes } from "$lib/docs-content.js";

export const prerender = true;

const SITE = "https://middy.js.org";

const SECTION_ORDER = [
	["", "Overview"],
	["intro", "Introduction"],
	["middlewares", "Middlewares"],
	["routers", "Routers"],
	["handlers", "Handlers"],
	["events", "Events"],
	["writing-middlewares", "Writing Middlewares"],
	["best-practices", "Best Practices"],
	["recipes", "Recipes"],
	["compare", "Comparisons"],
	["integrations", "Integrations"],
	["upgrade", "Upgrade Guides"],
	["faq", "FAQ"],
];

function sectionKeyFor(href) {
	const segments = href
		.replace(/^\/docs\/?/, "")
		.split("/")
		.filter(Boolean);
	if (segments.length === 0) return "";
	return segments[0];
}

export const GET = () => {
	const routes = getDocsRoutes();
	const grouped = new Map(SECTION_ORDER.map(([key]) => [key, []]));

	for (const route of routes) {
		const key = sectionKeyFor(route.href);
		if (!grouped.has(key)) grouped.set(key, []);
		grouped.get(key).push(route);
	}

	const lines = [
		"# Middy.js",
		"",
		"> The stylish Node.js middleware engine for AWS Lambda. Organise your Lambda code, remove duplication, and focus on business logic.",
		"",
		"Middy is a middleware engine for AWS Lambda on Node.js (>= 22, ESM). It composes reusable middlewares (parsing, validation, auth, observability, AWS-service fetching) around a plain async handler. 38 official packages cover API Gateway, SQS, S3, DynamoDB, SNS, EventBridge, Kinesis, Kafka, WebSockets, and more. First-class TypeScript types. Streaming + durable-function compatible.",
		"",
		`Full documentation as a single document: ${SITE}/llms-full.txt`,
		`Machine-readable index: ${SITE}/search.json`,
		"",
	];

	const labelFor = new Map(SECTION_ORDER);
	const renderedKeys = new Set();

	const renderSection = (key, items) => {
		if (!items || items.length === 0) return;
		const label = labelFor.get(key) ?? key;
		lines.push(`## ${label}`, "");
		for (const item of items) {
			const desc = item.description ? `: ${item.description}` : "";
			lines.push(`- [${item.title}](${SITE}${item.href})${desc}`);
		}
		lines.push("");
		renderedKeys.add(key);
	};

	for (const [key] of SECTION_ORDER) {
		renderSection(key, grouped.get(key));
	}
	// Any unanticipated section keys come last (stable order).
	for (const [key, items] of grouped) {
		if (renderedKeys.has(key)) continue;
		renderSection(key, items);
	}

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

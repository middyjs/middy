import { getDocsRoutes, getLastUpdated } from "$lib/docs-content.js";

export const prerender = true;

const SITE = "https://middy.js.org";

const STATIC_ROUTES = ["/"];

function escapeXml(value) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export const GET = () => {
	const buildDate = new Date().toISOString();
	const lastmodByPath = new Map();
	for (const path of STATIC_ROUTES) {
		lastmodByPath.set(path, getLastUpdated(path));
	}
	for (const route of getDocsRoutes()) {
		lastmodByPath.set(route.href, route.lastUpdated);
	}
	const urls = [...lastmodByPath.keys()].sort();

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map((path) => {
		const lastmod = (lastmodByPath.get(path) ?? buildDate).slice(0, 10);
		return `\t<url>\n\t\t<loc>${escapeXml(SITE + path)}</loc>\n\t\t<lastmod>${lastmod}</lastmod>\n\t\t<changefreq>weekly</changefreq>\n\t\t<priority>${path === "/" ? "1.0" : "0.8"}</priority>\n\t</url>`;
	})
	.join("\n")}
</urlset>
`;

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

import { getDocsRoutes } from "$lib/docs-content.js";

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
	const docs = getDocsRoutes().map((r) => r.href);
	const urls = [...new Set([...STATIC_ROUTES, ...docs])].sort();

	const lastmod = new Date().toISOString().slice(0, 10);

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map(
		(path) =>
			`\t<url>\n\t\t<loc>${escapeXml(SITE + path)}</loc>\n\t\t<lastmod>${lastmod}</lastmod>\n\t\t<changefreq>weekly</changefreq>\n\t\t<priority>${path === "/" ? "1.0" : "0.8"}</priority>\n\t</url>`,
	)
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

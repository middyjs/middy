import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildSearchIndex,
	cleanContentForSearch,
	extractTitle,
	highlightSegments,
	searchIndex,
} from "./search.js";

const page = (title, body) =>
	`---\ntitle: ${title}\nposition: 1\n---\n\n${body}`;

describe("extractTitle", () => {
	test("reads the frontmatter title", () => {
		equal(extractTitle(page("Intro", "# Heading")), "Intro");
	});

	test("strips surrounding quotes", () => {
		equal(extractTitle(page("'Quoted'", "")), "Quoted");
		equal(extractTitle(page('"Double"', "")), "Double");
	});

	test("falls back to the first h1 when frontmatter has no title", () => {
		equal(
			extractTitle("---\nposition: 2\n---\n# From heading\n"),
			"From heading",
		);
		equal(extractTitle("# Only heading"), "Only heading");
	});

	test("returns Untitled when nothing matches", () => {
		equal(extractTitle("plain text"), "Untitled");
	});
});

describe("cleanContentForSearch", () => {
	test("removes markdown, code, script and style noise", () => {
		const content = [
			"---",
			"title: X",
			"---",
			"<script>",
			"  import Note from '@components/Note.svelte'",
			"</script>",
			"<style>p { color: red }</style>",
			"## Heading",
			"",
			"Some **bold** and _italic_ text with a [link](https://example.com).",
			"",
			"```js",
			"const hidden = true",
			"```",
			"",
			"- item one",
			"* item two",
			"Inline `code()` here.",
		].join("\n");
		equal(
			cleanContentForSearch(content),
			"Heading Some bold and italic text with a link. item one item two Inline here.",
		);
	});
});

describe("buildSearchIndex", () => {
	test("maps file paths to hrefs, ids, titles and cleaned text", () => {
		const index = buildSearchIndex([
			{ filePath: "+page.md", content: page("Docs", "Welcome") },
			{
				filePath: "middlewares/http-cors/+page.md",
				content: page("CORS", "Adds CORS headers"),
			},
		]);
		deepEqual(index, [
			{ id: "home", href: "/docs", title: "Docs", text: "Welcome" },
			{
				id: "middlewares-http-cors",
				href: "/docs/middlewares/http-cors",
				title: "CORS",
				text: "Adds CORS headers",
			},
		]);
	});
});

describe("highlightSegments", () => {
	test("marks every case-insensitive occurrence", () => {
		deepEqual(highlightSegments("Cors and cors", "cors"), [
			{ text: "Cors", match: true },
			{ text: " and ", match: false },
			{ text: "cors", match: true },
		]);
	});

	test("keeps leading and trailing text", () => {
		deepEqual(highlightSegments("pre <b>x</b> post", "x"), [
			{ text: "pre <b>", match: false },
			{ text: "x", match: true },
			{ text: "</b> post", match: false },
		]);
	});

	test("returns one segment when nothing matches", () => {
		deepEqual(highlightSegments("nothing", "zzz"), [
			{ text: "nothing", match: false },
		]);
	});

	test("takes regex metacharacters in the needle literally", () => {
		deepEqual(highlightSegments("a.b and aXb", ".*"), [
			{ text: "a.b and aXb", match: false },
		]);
	});
});

describe("searchIndex", () => {
	const index = buildSearchIndex([
		{ filePath: "a/+page.md", content: page("A", "The quick brown fox") },
		{ filePath: "b/+page.md", content: page("B", "Nothing to see") },
		{ filePath: "c/+page.md", content: page("C", "fox at start, FOX later") },
		{ filePath: "d/+page.md", content: page("D", "ends with fox") },
		{ filePath: "e/+page.md", content: page("E", "a.b literal and aXb") },
	]);

	test("returns nothing for an empty or blank query", () => {
		deepEqual(searchIndex(index, ""), []);
		deepEqual(searchIndex(index, "   "), []);
	});

	test("matches case-insensitively and highlights the snippet", () => {
		const results = searchIndex(index, "Fox");
		deepEqual(
			results.map((r) => r.href),
			["/docs/a", "/docs/c", "/docs/d"],
		);
		deepEqual(results[0], {
			id: "a",
			href: "/docs/a",
			title: "A",
			description: [
				{ text: "The quick brown ", match: false },
				{ text: "fox", match: true },
			],
		});
		deepEqual(results[1].description, [
			{ text: "fox", match: true },
			{ text: " at start, ", match: false },
			{ text: "FOX", match: true },
			{ text: " later", match: false },
		]);
	});

	test("treats regex metacharacters in the query literally", () => {
		const results = searchIndex(index, "a.b");
		equal(results.length, 1);
		deepEqual(results[0].description, [
			{ text: "a.b", match: true },
			{ text: " literal and aXb", match: false },
		]);
	});

	test("caps the number of results", () => {
		equal(searchIndex(index, "fox", { maxResults: 2 }).length, 2);
	});

	test("centres a bounded snippet around the first match with ellipses", () => {
		const long = `${"x".repeat(200)} needle ${"y".repeat(200)}`;
		const [result] = searchIndex(
			buildSearchIndex([{ filePath: "long/+page.md", content: long }]),
			"needle",
			{ snippetLength: 20 },
		);
		const text = result.description.map((s) => s.text).join("");
		equal(text, "...xxxxxxxxx needle yyy...");
		equal(text.length, 26);
	});

	test("omits the leading ellipsis when the match is near the start", () => {
		const [result] = searchIndex(
			buildSearchIndex([
				{ filePath: "s/+page.md", content: `needle ${"z".repeat(100)}` },
			]),
			"needle",
			{ snippetLength: 20 },
		);
		equal(
			result.description.map((s) => s.text).join(""),
			"needle zzzzzzzzzzzzz...",
		);
	});
});

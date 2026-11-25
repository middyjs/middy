import { deepStrictEqual } from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, mock, test } from "node:test";
import { analyze } from "sast-json-schema/cli";

const toJsonSchema = (schema) =>
	JSON.parse(
		JSON.stringify(schema, (key, value) =>
			value instanceof RegExp ? value.source : value,
		),
	);

const packagesUrl = new URL("../packages/", import.meta.url);
const utilUrl = new URL("util/index.js", packagesUrl).href;

const modules = [];
for (const entry of readdirSync(packagesUrl, { withFileTypes: true })) {
	if (!entry.isDirectory() || entry.name === "util") continue;
	const packageUrl = new URL(`${entry.name}/`, packagesUrl);
	for (const file of readdirSync(packageUrl)) {
		if (!file.endsWith(".js") || /\.(test|fuzz|bench|load)\./.test(file)) {
			continue;
		}
		const moduleUrl = new URL(file, packageUrl);
		if (readFileSync(moduleUrl, "utf8").includes("validateOptions(")) {
			modules.push({ path: `packages/${entry.name}/${file}`, moduleUrl });
		}
	}
}

const util = await import(utilUrl);
const captured = [];
let caller;
mock.module(utilUrl, {
	namedExports: {
		...util,
		validateOptions: (packageName, schema, options) => {
			captured.push({ ...caller, schema });
			return options;
		},
	},
});

const uncaptured = [];
for (const { path, moduleUrl } of modules) {
	const before = captured.length;
	const module = await import(moduleUrl.href);
	for (const exportName of Object.keys(module)) {
		if (!exportName.endsWith("ValidateOptions")) continue;
		caller = { path, exportName };
		try {
			module[exportName]({});
		} catch {}
	}
	if (captured.length === before) uncaptured.push(path);
}

const combinatorKeywords = new Set(["allOf", "anyOf", "oneOf", "if"]);
const formatFindings = (findings) =>
	findings
		.filter(({ keyword }) => !combinatorKeywords.has(keyword))
		.map(
			({ instancePath, keyword, message }) =>
				`  ${instancePath || "/"} ${keyword}: ${message}`,
		)
		.join("\n");

describe("option schemas pass sast-json-schema", () => {
	test("every module that calls validateOptions passes a schema through a *ValidateOptions export", () => {
		deepStrictEqual(uncaptured, []);
	});

	for (const { path, exportName, schema } of captured) {
		test(exportName, async () => {
			// Options are only deserialized in JavaScript; the default language
			// list also flags http-x402's `description`, an x402 spec field name.
			const findings = await analyze(toJsonSchema(schema), {
				offline: true,
				lang: "js",
			});
			deepStrictEqual(
				findings,
				[],
				`${exportName} (${path}): ${findings.length} findings\n${formatFindings(findings)}`,
			);
		});
	}
});

// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// node:bench reporter writing a markdown summary, for $GITHUB_STEP_SUMMARY.
// --bench-reporter=spec --bench-reporter-destination=stdout
// --bench-reporter=./.github/reporters/node-bench.mjs --bench-reporter-destination=$GITHUB_STEP_SUMMARY
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
const rate = (n) =>
	n >= 1e6
		? `${(n / 1e6).toFixed(2)}M`
		: n >= 1e3
			? `${(n / 1e3).toFixed(2)}k`
			: n.toFixed(2);

export default async function* (source) {
	const rows = [];
	let failed = 0;
	for await (const { type, data } of source) {
		if (type !== "bench:complete") continue;
		const name = cell(data.namePath.join(" › "));
		const at = `${relative(process.cwd(), fileURLToPath(data.file))}:${data.line}`;
		if (data.error) {
			failed++;
			rows.push(`| ❌ ${name} | ${at} | ${cell(data.error.message)} | | |`);
			continue;
		}
		const {
			median,
			confidenceInterval: ci,
			coefficientOfVariation: cv,
		} = data.summary;
		rows.push(
			`| ${name} | ${at} | ${rate(median)} ops/s | ${rate(ci.lower)} - ${rate(ci.upper)} | ${(cv * 100).toFixed(1)}% |`,
		);
	}
	yield `## ${failed ? "❌" : "✅"} node:bench ${process.version}\n\n`;
	yield "| Benchmark | Location | Median | 95% CI (mean) | CV |\n| --- | --- | --- | --- | --- |\n";
	yield `${rows.join("\n")}\n`;
}

// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// node:test reporter writing a markdown summary, for $GITHUB_STEP_SUMMARY.
// --test-reporter=spec --test-reporter-destination=stdout
// --test-reporter=./.github/reporters/node-test.mjs --test-reporter-destination=$GITHUB_STEP_SUMMARY
import { relative } from "node:path";

const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");

export default async function* (source) {
	const counts = { pass: 0, fail: 0, skip: 0, todo: 0 };
	const failures = [];
	let coverage;
	for await (const { type, data } of source) {
		if (type === "test:coverage") coverage = data.summary.totals;
		if (type !== "test:pass" && type !== "test:fail") continue;
		if (data.details.type === "suite") continue;
		if (data.skip) counts.skip++;
		else if (data.todo) counts.todo++;
		else if (type === "test:pass") counts.pass++;
		else {
			counts.fail++;
			const at = data.file
				? `${relative(process.cwd(), data.file)}:${data.line}`
				: "";
			const error = data.details.error;
			failures.push(
				`| ${cell(data.name)} | ${at} | ${cell((error.cause ?? error).message)} |`,
			);
		}
	}
	yield `## ${counts.fail ? "❌" : "✅"} node:test ${process.version}\n\n`;
	yield "| Pass | Fail | Skip | Todo |\n| --- | --- | --- | --- |\n";
	yield `| ${counts.pass} | ${counts.fail} | ${counts.skip} | ${counts.todo} |\n\n`;
	if (failures.length) {
		yield `### Failures\n\n| Test | Location | Error |\n| --- | --- | --- |\n${failures.join("\n")}\n\n`;
	}
	if (coverage) {
		const pct = (n) => `${n.toFixed(2)}%`;
		yield "### Coverage\n\n| Lines | Branches | Functions |\n| --- | --- | --- |\n";
		yield `| ${pct(coverage.coveredLinePercent)} | ${pct(coverage.coveredBranchPercent)} | ${pct(coverage.coveredFunctionPercent)} |\n`;
	}
}

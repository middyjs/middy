// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// Stryker reporter appending a markdown summary to $GITHUB_STEP_SUMMARY; no-op
// outside GitHub Actions. Shape matches declareClassPlugin() from
// @stryker-mutator/api, which is not a direct dependency.
import { appendFileSync } from "node:fs";

const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");

class GithubSummaryReporter {
	static inject = [];

	onMutationTestReportReady(report, metricsResult) {
		const path = process.env.GITHUB_STEP_SUMMARY;
		if (!path) return;
		const m = metricsResult.systemUnderTestMetrics.metrics;
		const score = Number.isNaN(m.mutationScore)
			? "n/a"
			: `${m.mutationScore.toFixed(2)}%`;
		const survivors = [];
		for (const [file, { mutants }] of Object.entries(report.files)) {
			for (const mutant of mutants) {
				if (mutant.status !== "Survived" && mutant.status !== "NoCoverage")
					continue;
				const { line, column } = mutant.location.start;
				survivors.push(
					`| ${file}:${line}:${column} | ${mutant.status} | ${mutant.mutatorName} | \`${cell(mutant.replacement ?? "")}\` |`,
				);
			}
		}
		let md = `## ${survivors.length ? "❌" : "✅"} Stryker ${process.env.MUTATE_PACKAGE ?? ""}\n\n`;
		md +=
			"| Score | Killed | Timeout | Survived | No coverage | Errors |\n| --- | --- | --- | --- | --- | --- |\n";
		md += `| ${score} | ${m.killed} | ${m.timeout} | ${m.survived} | ${m.noCoverage} | ${m.runtimeErrors + m.compileErrors} |\n\n`;
		if (survivors.length) {
			md += `### Surviving mutants\n\n| Location | Status | Mutator | Replacement |\n| --- | --- | --- | --- |\n${survivors.join("\n")}\n`;
		}
		appendFileSync(path, md);
	}
}

export const strykerPlugins = [
	{
		kind: "Reporter",
		name: "github-summary",
		injectableClass: GithubSummaryReporter,
	},
];

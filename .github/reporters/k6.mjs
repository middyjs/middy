// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// k6 handleSummary: markdown table to stdout, and to $GITHUB_STEP_SUMMARY when set.
// Re-export from a load test: export { handleSummary } from "../../.github/reporters/k6.mjs";
// ponytail: inline over jslib textSummary, which is a remote, unpinned import.

// k6 overwrites handleSummary files, so keep what earlier runs in this step
// wrote. open() is only allowed in the init context.
const summaryPath = __ENV.GITHUB_STEP_SUMMARY;
const prior = summaryPath ? open(summaryPath) : "";

const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(2));

export const handleSummary = (data) => {
	const failed = Object.values(data.metrics).some((m) =>
		Object.values(m.thresholds ?? {}).some(({ ok }) => !ok),
	);
	const byName = ([a], [b]) => a.localeCompare(b);
	const rows = Object.entries(data.metrics)
		.sort(byName)
		.map(([name, m]) => {
			const thresholds = Object.entries(m.thresholds ?? {})
				.map(([t, { ok }]) => `${ok ? "✅" : "❌"} \`${cell(t)}\``)
				.join(" ");
			const values = Object.entries(m.values)
				.sort(byName)
				.map(([k, v]) => `${k}=${fmt(v)}`)
				.join(" ");
			return `| ${name} | ${values} | ${thresholds} |`;
		});
	const md = `## ${failed ? "❌" : "✅"} k6 ${__ENV.LOAD_TEST ?? ""}\n\n| Metric | Values | Thresholds |\n| --- | --- | --- |\n${rows.join("\n")}\n\n`;
	const out = { stdout: md };
	if (summaryPath) out[summaryPath] = prior + md;
	return out;
};

#!/usr/bin/env node
// Generates src/lib/docs-mtimes.json mapping doc page paths to their git
// last-commit ISO date. Run before `vite build`. Falls back to filesystem mtime
// when git history is unavailable (shallow clone, etc.).
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const docsRoot = resolve(__dirname, "../routes/docs");
const homeRoute = resolve(__dirname, "../routes/+page.svelte");
const outFile = resolve(__dirname, "../lib/docs-mtimes.json");

const walk = (dir, acc = []) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, acc);
		} else if (entry.isFile() && full.endsWith("+page.md")) {
			acc.push(full);
		}
	}
	return acc;
};

const fileToHref = (file) => {
	const rel = relative(docsRoot, file)
		.replace(/\\/g, "/")
		.replace(/\/?\+page\.md$/, "");
	return rel === "" ? "/docs" : `/docs/${rel}`;
};

const gitDate = (file) => {
	try {
		const out = execFileSync("git", ["log", "-1", "--format=%aI", "--", file], {
			cwd: repoRoot,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim();
		return out || null;
	} catch {
		return null;
	}
};

const fileDate = (file) => {
	try {
		return new Date(statSync(file).mtimeMs).toISOString();
	} catch {
		return null;
	}
};

const dateFor = (file) => gitDate(file) ?? fileDate(file);

const map = {};
for (const file of walk(docsRoot)) {
	const date = dateFor(file);
	if (date) map[fileToHref(file)] = date;
}
const homeDate = dateFor(homeRoute);
if (homeDate) map["/"] = homeDate;

writeFileSync(outFile, `${JSON.stringify(map, null, 2)}\n`);
console.log(
	`Wrote ${Object.keys(map).length} entries to ${relative(process.cwd(), outFile)}`,
);

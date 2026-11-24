// Sync internal workspace dependency ranges to the root version.
// Run after `npm version <v> --workspaces --no-workspaces-update` and before `npm install`,
// so npm never tries to resolve the previous (possibly too new for min-release-age) version from the registry.
// Usage: node .github/release-sync.mjs [--copy-license]
import { copyFileSync, globSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const copyLicense = process.argv.includes("--copy-license");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

const { version, workspaces } = readJson("package.json");
const files = globSync(workspaces.map((pattern) => `${pattern}/package.json`));
const names = new Set(files.map((file) => readJson(file).name));

for (const file of files) {
	const source = readFileSync(file, "utf8");
	const pkg = JSON.parse(source);
	for (const field of [
		"dependencies",
		"devDependencies",
		"peerDependencies",
		"optionalDependencies",
	]) {
		for (const name in pkg[field]) {
			if (names.has(name)) {
				// keep the range operator (`^`, `~`, ...); `*` has no version and is left as is
				pkg[field][name] = pkg[field][name].replace(/\d.*$/, version);
			}
		}
	}
	const output = `${JSON.stringify(pkg, null, "\t")}\n`;
	if (output !== source) writeFileSync(file, output);
	if (copyLicense && !pkg.private) {
		copyFileSync("LICENSE", join(dirname(file), "LICENSE"));
	}
}

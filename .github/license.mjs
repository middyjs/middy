import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { EOL } from "node:os";
import { basename, extname, matchesGlob } from "node:path";

const DEFAULT_IGNORES = [
	"**/node_modules",
	"**/dist",
	"**/.git",
	"**/LICENSE*",
	"**/*.png",
	"**/*.jpg",
	"**/*.jpeg",
	"**/*.gif",
	"**/*.tif",
	"**/*.ico",
	"**/*.json",
	"**/*.zip",
	"**/*.tgz",
];
const DEFAULT_FORMATS = {
	"gitignore|npmignore|eslintignore|dockerignore|sh|py": {
		eachLine: { prepend: "# " },
	},
	"html|xml|svg": { prepend: "<!--", append: "-->" },
	"js|ts|css|scss|less|php|as|c|java|cpp|go|cto|acl": {
		prepend: "/*",
		append: "*/",
	},
	txt: {},
};

const [mode, ...args] = process.argv.slice(2);
if (!["check", "add", "remove"].includes(mode)) {
	console.error(
		"Usage: node .github/license.mjs <check|add|remove> [-f config] [-r replacements...]",
	);
	process.exit(2);
}

let configPath = ".license.config.json";
let replacements;
for (let i = 0; i < args.length; i++) {
	if (args[i] === "-f" || args[i] === "--config-file") configPath = args[++i];
	else if (args[i] === "-r" || args[i] === "--regex-replacements") {
		replacements = [];
		while (i + 1 < args.length && !args[i + 1].startsWith("-"))
			replacements.push(args[++i]);
	} else configPath = args[i];
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
if (!config.license)
	throw new Error("Missing required field in config: license");
const license = readFileSync(config.license, "utf8").replace(
	/^(\r\n|\n)+|(\r\n|\n)+$/g,
	"",
);
const trim = config.trailingWhitespace?.toUpperCase() === "TRIM";
const regexId = config.regexIdentifier;
if (regexId && mode === "add" && !replacements) {
	throw new Error(
		"Must supply regexReplacements option when using regexIdentifier in config when in INSERT mode",
	);
}

const formats = {};
for (const group of [DEFAULT_FORMATS, config.licenseFormats ?? {}]) {
	for (const [keys, format] of Object.entries(group)) {
		for (const key of keys.split("|")) {
			formats[key.startsWith("^") ? key.slice(1) : `.${key}`] = format;
		}
	}
}
const defaultFormat = config.defaultFormat ?? { prepend: "/*", append: "*/" };

const formatLicense = (format) => {
	if ("file" in format) return readFileSync(format.file, "utf8");
	let text = license;
	if ("eachLine" in format) {
		text = text
			.split(/\r\n|\n/)
			.map((line) => {
				line = `${format.eachLine.prepend ?? ""}${line}${format.eachLine.append ?? ""}`;
				return trim ? line.replace(/\s+$/, "") : line;
			})
			.join(EOL);
	}
	if ("prepend" in format) text = format.prepend + EOL + text;
	if ("append" in format) text = text + EOL + format.append;
	return text;
};

const MARKER = "\0";
const normalise = (text) =>
	text
		.split(/\r?\n/)
		.map((line) => (trim ? line : line.replace(/\s+$/, "")))
		.join("\n");
const toPattern = (text) => {
	const parts = regexId ? text.split(regexId) : [text];
	if (parts.length % 2 === 0) {
		throw new Error(
			"Odd number of regex identifiers found. One must be missing its close",
		);
	}
	const regexes = parts.filter((_, i) => i % 2);
	return normalise(parts.filter((_, i) => !(i % 2)).join(MARKER))
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		.split(MARKER)
		.map((part, i, all) => (i < all.length - 1 ? part + regexes[i] : part))
		.join("");
};
const fillRegex = (text) => {
	let next = 0;
	return text
		.split(/\r?\n/)
		.map((line) =>
			line
				.split(regexId)
				.map((part, i) => {
					if (!(i % 2)) return part;
					let value = replacements[0];
					if (replacements.length > 1) {
						if (next === replacements.length) {
							throw new Error(
								`Too few replacement values passed. Found at least ${next + 1} regex values. Only have ${replacements.length} replacements`,
							);
						}
						value = replacements[next++];
					}
					if (!value.match(part)) {
						throw new Error(
							`Replacement value ${value} does not match regex it is to replace: ${part}`,
						);
					}
					return value;
				})
				.join(""),
		)
		.join(EOL);
};

const undot = (path) => path.replace(/(^|\/)\./g, "$1\u0001");
const ignores = [
	...(config.ignore ?? []),
	...(config.ignoreDefaultIgnores ? [] : DEFAULT_IGNORES),
].map(undot);
const include = ignores
	.filter((glob) => glob.startsWith("!"))
	.map((glob) => glob.slice(1));
const exclude = ignores.filter((glob) => !glob.startsWith("!"));
const isIgnored = (file) => {
	const parts = undot(file).split("/");
	const hit = parts.some((_, i) => {
		const path = parts.slice(0, i + 1).join("/");
		return exclude.some((glob) => matchesGlob(path, glob));
	});
	return hit && !include.some((glob) => matchesGlob(undot(file), glob));
};

const gitArgs = ["ls-files", "-co", "--exclude-standard"];
if (config.ignoreFile) gitArgs.push(`--exclude-from=${config.ignoreFile}`);
const files = execFileSync("git", gitArgs, { encoding: "utf8" })
	.split("\n")
	.filter(
		(file) =>
			file &&
			file !== config.ignoreFile &&
			existsSync(file) &&
			!isIgnored(file),
	);

const cache = new Map();
const changed = [];
for (const file of files) {
	const format = formats[extname(file) || basename(file)] ?? defaultFormat;
	if (!cache.has(format)) {
		const formatted = formatLicense(format);
		cache.set(format, { formatted, pattern: toPattern(formatted) });
	}
	const { formatted, pattern } = cache.get(format);
	const contents = readFileSync(file, "utf8");
	const found = new RegExp(pattern).test(normalise(contents));

	if (mode === "check" && !found) {
		console.error("\x1b[31m✗\x1b[0m License not found in", file);
		changed.push(file);
	} else if (mode === "add" && !found) {
		const header = regexId ? fillRegex(formatted) : formatted;
		if (contents.startsWith("#!")) {
			const [shebang, ...rest] = contents.split(/\r?\n/);
			writeFileSync(file, shebang + EOL + header + EOL + rest.join(EOL));
		} else {
			writeFileSync(file, header + EOL + contents);
		}
		changed.push(file);
	} else if (mode === "remove" && found) {
		const lines = contents.split(/\r?\n/);
		const licenseLines = pattern.split(/\r?\n/).map((line) => `^${line}`);
		const start = lines.findIndex(
			(line, i) =>
				line.match(licenseLines[0]) &&
				lines
					.slice(i + 1, i + licenseLines.length)
					.every((next, j) => next.match(licenseLines[j + 1])),
		);
		if (start !== -1) {
			lines.splice(start, licenseLines.length);
			writeFileSync(file, lines.join(EOL));
		}
		changed.push(file);
	}
}

if (config.output) writeFileSync(config.output, changed.join(EOL));

if (mode === "add") {
	console.log(
		`\x1b[33m!\x1b[0m Inserted license into ${changed.length} file(s)`,
	);
} else if (mode === "remove") {
	console.log(
		`\x1b[32m✔\x1b[0m Removed license from ${changed.length} file(s).`,
	);
} else if (changed.length) {
	console.error(
		`License check failed. ${changed.length} file(s) did not have the license.`,
	);
	process.exit(1);
} else {
	console.log("\x1b[32m✔\x1b[0m All files have licenses.");
}

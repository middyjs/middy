#!/usr/bin/env node
/*
Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
SPDX-License-Identifier: MIT
*/
// Pulls MIDDY_CAPTURE lines from the capture log group(s), keeps the newest
// event per kind, sanitizes it, writes fixtures/<kind>.json, and prints the
// coverage matrix against manifest.json. See SPEC.md.
//
// Review fixtures before committing: sanitization is regex-based, not a
// guarantee. Assumes AWS_PROFILE is set; AWS_REGION defaults to us-east-1.
process.env.AWS_REGION ??= "us-east-1";

// Fixtures are ground truth for phase 2 schemas: only real AWS may write them.
// An emulator (floci/LocalStack) captures that emulator's guess at the shape.
if (process.env.AWS_ENDPOINT_URL) {
	throw new Error(
		`refusing to write fixtures against AWS_ENDPOINT_URL=${process.env.AWS_ENDPOINT_URL}`,
	);
}

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { CloudWatchLogs } from "@aws-sdk/client-cloudwatch-logs";

const STACK = process.env.STACK_NAME ?? "middy-events";
const REGION = process.env.AWS_REGION;
const EDGE_REGIONS = (
	process.env.EDGE_REGIONS ?? `${REGION},us-east-1,ca-central-1,us-west-2`
)
	.split(",")
	.filter((v, i, a) => a.indexOf(v) === i);
const manifest = JSON.parse(
	readFileSync(new URL("./manifest.json", import.meta.url), "utf8"),
).kinds;

const cfn = new CloudFormation({});
const { Stacks } = await cfn.describeStacks({ StackName: STACK });
const out = Object.fromEntries(
	(Stacks[0].Outputs ?? []).map((o) => [o.OutputKey, o.OutputValue]),
);

// --- gather captures (newest per kind) -------------------------------------
// canonicalize manifest aliases so a capture can never be filed (or reported
// missing) under an alias id
const aliasToId = new Map(
	manifest.flatMap((k) => (k.aliases ?? []).map((a) => [a, k.id])),
);
const captures = new Map(); // kind -> {timestamp, event}
const scan = async (region, logGroupName) => {
	const logs = new CloudWatchLogs({ region });
	let nextToken;
	do {
		const res = await logs
			.filterLogEvents({
				logGroupName,
				filterPattern: '"MIDDY_CAPTURE"',
				nextToken,
			})
			.catch(() => ({ events: [] }));
		for (const ev of res.events ?? []) {
			const m = ev.message.match(/MIDDY_CAPTURE (\S+) (.*)$/s);
			if (!m) continue;
			const kind = aliasToId.get(m[1]) ?? m[1];
			const json = m[2];
			const prev = captures.get(kind);
			if (prev && prev.timestamp >= ev.timestamp) continue;
			try {
				captures.set(kind, {
					timestamp: ev.timestamp,
					event: JSON.parse(json.trim()),
				});
			} catch {
				// truncated log line (256 KB ceiling); keep whatever parsed before
			}
		}
		nextToken = res.nextToken;
	} while (nextToken);
};

await scan(REGION, out.CaptureLogGroupName);
if (out.DistributionDomain) {
	for (const region of EDGE_REGIONS) {
		const logs = new CloudWatchLogs({ region });
		const groups = await logs
			.describeLogGroups({
				logGroupNamePrefix: `/aws/lambda/us-east-1.${STACK}-edge-`,
			})
			.catch(() => ({ logGroups: [] }));
		for (const g of groups.logGroups ?? []) await scan(region, g.logGroupName);
	}
}

// --- sanitize --------------------------------------------------------------
const REDACT_KEYS =
	/^(authorization|x-amz-security-token|authorizationtoken|identitysource|token|tasktoken|clientrequesttoken|resulttoken|responseurl|inputs3url|apikey|x-api-key)$/i;
const sanitizeString = (s) =>
	s
		.replace(/\b\d{12}\b/g, "123456789012")
		.replace(
			/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
			"00000000-0000-0000-0000-000000000000",
		)
		.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "127.0.0.1")
		.replace(
			/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g,
			(m) => `2026-01-01T00:00:00${m.includes(".") ? ".000" : ""}Z`,
		)
		.replace(/^\d{13}$/, "1767225600000")
		.replace(/^\d{10}$/, "1767225600")
		.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "REDACTED.JWT.REDACTED");
// redaction must preserve container structure (e.g. identitySource is an
// array of strings): only leaf strings become "REDACTED"
const redactLeaf = (value) => {
	if (typeof value === "string") return "REDACTED";
	if (Array.isArray(value)) return value.map(redactLeaf);
	if (value && typeof value === "object") {
		const o = {};
		for (const [k, v] of Object.entries(value)) o[k] = redactLeaf(v);
		return o;
	}
	return value;
};
const sanitize = (value, key = "") => {
	if (REDACT_KEYS.test(key)) return redactLeaf(value);
	if (typeof value === "string") return sanitizeString(value);
	if (Array.isArray(value)) return value.map((v) => sanitize(v));
	if (value && typeof value === "object") {
		const o = {};
		for (const [k, v] of Object.entries(value)) o[k] = sanitize(v, k);
		return o;
	}
	return value;
};

// --- write fixtures --------------------------------------------------------
mkdirSync(new URL("./fixtures/", import.meta.url), { recursive: true });
let written = 0;
for (const [kind, { event }] of captures) {
	writeFileSync(
		new URL(`./fixtures/${kind}.json`, import.meta.url),
		`${JSON.stringify(sanitize(event), null, "\t")}\n`,
	);
	written++;
}

// --- coverage matrix -------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nfixtures written: ${written}\n`);
console.log(`${pad("kind", 34)}${pad("middy", 15)}${pad("trigger", 11)}status`);
console.log("-".repeat(72));
let missing = 0;
for (const k of manifest) {
	let status;
	if (captures.has(k.id)) status = "captured";
	else if (k.trigger === "documented") status = "documented";
	else if (k.requires && !out[k.requires]) status = "skipped (tier off)";
	else if (k.trigger === "manual") status = "manual";
	else {
		status = "MISSING";
		missing++;
	}
	console.log(
		`${pad(k.id, 34)}${pad(k.middy, 15)}${pad(k.trigger, 11)}${status}`,
	);
}
const stray = [...captures.keys()].filter(
	(id) => !manifest.some((k) => k.id === id || k.aliases?.includes(id)),
);
if (stray.length)
	console.log("\nnot in manifest (spec bug):", stray.join(", "));
console.log(
	`\ntrue coverage: ${missing === 0 ? "GREEN" : `${missing} enabled kind(s) missing`}`,
);
process.exit(missing ? 1 : 0);

import { ok, strictEqual } from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// The certificates/ directory is a build artifact produced by ./bin/certificates
// (downloaded from AWS at build/publish time) and is gitignored. When it has not
// been built (e.g. in CI before `npm run build`), these validation tests skip
// rather than fail on a missing module.
const regions = [
	"af-south-1",
	"ap-east-1",
	"ap-northeast-1",
	"ap-northeast-2",
	"ap-northeast-3",
	"ap-south-1",
	"ap-south-2",
	"ap-southeast-1",
	"ap-southeast-2",
	"ap-southeast-3",
	"ap-southeast-4",
	"ap-southeast-5",
	"ap-southeast-7",
	"ca-central-1",
	"ca-west-1",
	"eu-central-1",
	"eu-central-2",
	"eu-north-1",
	"eu-south-1",
	"eu-south-2",
	"eu-west-1",
	"eu-west-2",
	"eu-west-3",
	"global",
	"il-central-1",
	"me-central-1",
	"me-south-1",
	"mx-central-1",
	"sa-east-1",
	"us-east-1",
	"us-east-2",
	"us-gov-east-1",
	"us-gov-west-1",
	"us-west-1",
	"us-west-2",
];

for (const region of regions) {
	const url = new URL(`./certificates/${region}.js`, import.meta.url);
	test(`certificate ${region} is a non-empty PEM bundle`, {
		skip: existsSync(fileURLToPath(url)) ? false : "certificates not built",
	}, async () => {
		const { default: cert } = await import(url.href);
		strictEqual(typeof cert, "string");
		ok(cert.length > 1000, `expected a real PEM, got length ${cert.length}`);
		ok(
			cert.startsWith("-----BEGIN CERTIFICATE-----"),
			"expected a PEM BEGIN marker",
		);
		ok(
			cert.trimEnd().endsWith("-----END CERTIFICATE-----"),
			"expected a PEM END marker",
		);
	});
}

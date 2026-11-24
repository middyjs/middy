// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// Ref: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html#UsingWithRDS.SSL.CertificatesAllRegions
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const regions = [
	"global",
	"us-east-1",
	"us-east-2",
	"us-west-1",
	"us-west-2",
	"af-south-1",
	"ap-east-1",
	"ap-south-2",
	"ap-southeast-3",
	"ap-southeast-4",
	"ap-southeast-5",
	"ap-southeast-7",
	"ap-south-1",
	"ap-northeast-3",
	"ap-northeast-1",
	"ap-northeast-2",
	"ap-southeast-1",
	"ap-southeast-2",
	"ca-central-1",
	"ca-west-1",
	"eu-central-1",
	"eu-west-1",
	"eu-west-2",
	"eu-south-1",
	"eu-west-3",
	"eu-south-2",
	"eu-north-1",
	"eu-central-2",
	"il-central-1",
	"me-south-1",
	"me-central-1",
	"mx-central-1",
	"sa-east-1",
];

export const govRegions = ["us-gov-east-1", "us-gov-west-1"];

const host = "truststore.pki.rds.amazonaws.com";
const govHost = "truststore.pki.us-gov-west-1.rds.amazonaws.com";
const retries = 5;
const retryDelay = 2000;

const download = async (region, url, { fetch, sleep }, attempt = 0) => {
	try {
		const response = await fetch(url, { redirect: "error" });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return response.text();
	} catch (cause) {
		if (attempt === retries) {
			throw new Error(`certificates: ${region} download failed: ${url}`, {
				cause,
			});
		}
		await sleep(retryDelay);
		return download(region, url, { fetch, sleep }, attempt + 1);
	}
};

const countFiles = (names, suffix) =>
	names.filter((name) => name.endsWith(suffix)).length;

export const buildCertificates = async ({
	dir,
	fetch = globalThis.fetch,
	sleep = delay,
} = {}) => {
	const certificates = join(dir, "certificates");
	const packageJson = join(dir, "package.json");
	await rm(certificates, { recursive: true, force: true });
	await mkdir(certificates);

	const generate = async (region, truststore) => {
		const url = `https://${truststore}/${region}/${region}-bundle.pem`;
		const bundle = await download(region, url, { fetch, sleep });
		if (!bundle.includes("BEGIN CERTIFICATE")) {
			throw new Error(`certificates: ${region} bundle is not a valid PEM`);
		}
		const pem = bundle.trimEnd();
		await writeFile(
			join(certificates, `${region}.js`),
			`export default \`${pem}\`\n`,
		);
		await writeFile(
			join(certificates, `${region}.d.ts`),
			"declare const ca: string;\nexport default ca;\n",
		);
		const pkg = JSON.parse((await readFile(packageJson)).toString());
		pkg.exports[`./certificates/${region}`] = {
			import: {
				types: `./certificates/${region}.d.ts`,
				default: `./certificates/${region}.js`,
			},
		};
		await writeFile(packageJson, `${JSON.stringify(pkg, null, "\t")}\n`);
	};

	for (const region of regions) {
		await generate(region, host);
	}
	for (const region of govRegions) {
		await generate(region, govHost);
	}

	const expected = regions.length + govRegions.length;
	const names = await readdir(certificates);
	const modules = countFiles(names, ".js");
	if (modules !== expected) {
		throw new Error(
			`certificates: expected ${expected} modules, generated ${modules}`,
		);
	}
	const declarations = countFiles(names, ".d.ts");
	if (declarations !== expected) {
		throw new Error(
			`certificates: expected ${expected} declarations, generated ${declarations}`,
		);
	}
};

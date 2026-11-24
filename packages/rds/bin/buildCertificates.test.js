import { deepStrictEqual, rejects, strictEqual } from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { buildCertificates, govRegions, regions } from "./buildCertificates.js";

const commercialHost = "truststore.pki.rds.amazonaws.com";
const govHost = "truststore.pki.us-gov-west-1.rds.amazonaws.com";

const allRegions = [
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
	"us-gov-east-1",
	"us-gov-west-1",
];

const pem = (region) =>
	`-----BEGIN CERTIFICATE-----\n${region}\n-----END CERTIFICATE-----\n`;

const okFetch = () =>
	mock.fn(async (url) => new Response(pem(url.split("/").at(-2))));

const noSleep = () => mock.fn(async () => {});

const exportEntry = (region) => ({
	import: {
		types: `./certificates/${region}.d.ts`,
		default: `./certificates/${region}.js`,
	},
});

let dir;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "middy-rds-certificates-"));
	await writeFile(
		join(dir, "package.json"),
		`${JSON.stringify({ name: "@middy/rds", exports: {} }, null, "\t")}\n`,
	);
});
afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("regions", () => {
	test("lists the commercial regions then the GovCloud regions", () => {
		deepStrictEqual([...regions, ...govRegions], allRegions);
		deepStrictEqual(govRegions, ["us-gov-east-1", "us-gov-west-1"]);
	});
});

describe("buildCertificates", () => {
	test("fetches every bundle from its truststore host without following redirects", async () => {
		const fetch = okFetch();
		await buildCertificates({ dir, fetch, sleep: noSleep() });
		deepStrictEqual(
			fetch.mock.calls.map((call) => call.arguments),
			allRegions.map((region) => [
				`https://${region.startsWith("us-gov-") ? govHost : commercialHost}/${region}/${region}-bundle.pem`,
				{ redirect: "error" },
			]),
		);
	});

	test("writes a string default export per region with trailing newlines stripped", async () => {
		const fetch = mock.fn(
			async () =>
				new Response(
					"-----BEGIN CERTIFICATE-----\r\nabc\n\n-----END CERTIFICATE-----\n\n\n",
				),
		);
		await buildCertificates({ dir, fetch, sleep: noSleep() });
		for (const region of allRegions) {
			strictEqual(
				await readFile(join(dir, "certificates", `${region}.js`), "utf8"),
				"export default `-----BEGIN CERTIFICATE-----\r\nabc\n\n-----END CERTIFICATE-----`\n",
			);
		}
	});

	test("writes a declaration per region", async () => {
		await buildCertificates({ dir, fetch: okFetch(), sleep: noSleep() });
		for (const region of allRegions) {
			strictEqual(
				await readFile(join(dir, "certificates", `${region}.d.ts`), "utf8"),
				"declare const ca: string;\nexport default ca;\n",
			);
		}
	});

	test("updates package.json exports in place, appending new regions, tab indented", async () => {
		await writeFile(
			join(dir, "package.json"),
			`${JSON.stringify(
				{
					name: "@middy/rds",
					exports: {
						".": { import: { default: "./index.js" } },
						"./certificates/us-east-2": "stale",
						"./ssl": { import: { default: "./ssl.js" } },
					},
					files: ["certificates/"],
				},
				null,
				"\t",
			)}\n`,
		);
		await buildCertificates({ dir, fetch: okFetch(), sleep: noSleep() });

		const exports = {
			".": { import: { default: "./index.js" } },
			"./certificates/us-east-2": exportEntry("us-east-2"),
			"./ssl": { import: { default: "./ssl.js" } },
		};
		for (const region of allRegions) {
			exports[`./certificates/${region}`] = exportEntry(region);
		}
		strictEqual(
			await readFile(join(dir, "package.json"), "utf8"),
			`${JSON.stringify({ name: "@middy/rds", exports, files: ["certificates/"] }, null, "\t")}\n`,
		);
	});

	test("replaces any previous certificates directory", async () => {
		await mkdir(join(dir, "certificates"));
		await writeFile(join(dir, "certificates", "stale.txt"), "");
		await buildCertificates({ dir, fetch: okFetch(), sleep: noSleep() });
		strictEqual(existsSync(join(dir, "certificates", "stale.txt")), false);
		strictEqual(existsSync(join(dir, "certificates", "global.js")), true);
	});

	test("retries a failed download every 2 seconds", async () => {
		let failures = 2;
		const fetch = mock.fn(async (url) => {
			if (failures-- > 0) throw new TypeError("fetch failed");
			return new Response(pem("global"));
		});
		const sleep = noSleep();
		await buildCertificates({ dir, fetch, sleep });
		deepStrictEqual(
			sleep.mock.calls.map((call) => call.arguments),
			[[2000], [2000]],
		);
		strictEqual(
			fetch.mock.calls[0].arguments[0],
			fetch.mock.calls[2].arguments[0],
		);
		strictEqual(fetch.mock.callCount(), allRegions.length + 2);
	});

	test("retries an HTTP error status", async () => {
		let failures = 1;
		const fetch = mock.fn(async () =>
			failures-- > 0
				? new Response("nope", { status: 503 })
				: new Response(pem("global")),
		);
		const sleep = noSleep();
		await buildCertificates({ dir, fetch, sleep });
		strictEqual(sleep.mock.callCount(), 1);
		strictEqual(
			await readFile(join(dir, "certificates", "global.js"), "utf8"),
			`export default \`${pem("global").trimEnd()}\`\n`,
		);
	});

	test("gives up after 5 retries", async () => {
		const fetch = mock.fn(async () => new Response("", { status: 404 }));
		let sleeps = 0;
		const sleep = mock.fn(async () => {
			sleeps += 1;
			if (sleeps > 5) throw new Error("retried past the limit");
		});
		await rejects(buildCertificates({ dir, fetch, sleep }), (error) => {
			strictEqual(
				error.message,
				`certificates: global download failed: https://${commercialHost}/global/global-bundle.pem`,
			);
			strictEqual(error.cause.message, "HTTP 404");
			return true;
		});
		strictEqual(fetch.mock.callCount(), 6);
		strictEqual(sleep.mock.callCount(), 5);
		strictEqual(existsSync(join(dir, "certificates", "global.js")), false);
	});

	test("rejects a bundle that is not a PEM", async () => {
		const fetch = mock.fn(async () => new Response("<html>oops</html>"));
		await rejects(buildCertificates({ dir, fetch, sleep: noSleep() }), {
			message: "certificates: global bundle is not a valid PEM",
		});
		strictEqual(existsSync(join(dir, "certificates", "global.js")), false);
	});

	test("fails when the module count does not match the region count", async () => {
		const fetch = mock.fn(async (url) => {
			await writeFile(join(dir, "certificates", "extra.js"), "");
			return new Response(pem("global"));
		});
		await rejects(buildCertificates({ dir, fetch, sleep: noSleep() }), {
			message: "certificates: expected 35 modules, generated 36",
		});
	});

	test("fails when the declaration count does not match the region count", async () => {
		const fetch = mock.fn(async (url) => {
			await writeFile(join(dir, "certificates", "extra.d.ts"), "");
			return new Response(pem("global"));
		});
		await rejects(buildCertificates({ dir, fetch, sleep: noSleep() }), {
			message: "certificates: expected 35 declarations, generated 36",
		});
	});

	test("defaults to global fetch", async (t) => {
		const fetch = t.mock.method(
			globalThis,
			"fetch",
			async () => new Response(pem("global")),
		);
		await buildCertificates({ dir, sleep: noSleep() });
		strictEqual(fetch.mock.callCount(), allRegions.length);
		strictEqual(
			existsSync(join(dir, "certificates", "us-gov-west-1.js")),
			true,
		);
	});
});

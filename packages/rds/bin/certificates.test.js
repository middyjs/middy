import { deepStrictEqual } from "node:assert/strict";
import { join } from "node:path";
import { mock, test } from "node:test";

test("builds the certificates into the package root", async () => {
	const buildCertificates = mock.fn(async () => {});
	mock.module(new URL("./buildCertificates.js", import.meta.url).href, {
		namedExports: { buildCertificates },
	});
	await import("./certificates.js");
	deepStrictEqual(
		buildCertificates.mock.calls.map((call) => call.arguments),
		[[{ dir: join(import.meta.dirname, "..") }]],
	);
});

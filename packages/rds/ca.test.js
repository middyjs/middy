import { strictEqual, throws } from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import getCa from "./ca.js";

const pemContent =
	"-----BEGIN CERTIFICATE-----\nMIIBIjANBgkq\n-----END CERTIFICATE-----\n";

test("ca() throws when NODE_EXTRA_CA_CERTS is not set", () => {
	const saved = process.env.NODE_EXTRA_CA_CERTS;
	delete process.env.NODE_EXTRA_CA_CERTS;
	try {
		throws(() => getCa(), /NODE_EXTRA_CA_CERTS/);
	} finally {
		if (saved !== undefined) process.env.NODE_EXTRA_CA_CERTS = saved;
	}
});

test("ca() reads PEM content when NODE_EXTRA_CA_CERTS is set", () => {
	const file = join(tmpdir(), "middy-rds-ca-test.pem");
	writeFileSync(file, pemContent);
	process.env.NODE_EXTRA_CA_CERTS = file;
	try {
		strictEqual(getCa(), pemContent);
	} finally {
		delete process.env.NODE_EXTRA_CA_CERTS;
		unlinkSync(file);
	}
});

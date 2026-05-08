import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import getSsl from "./ssl.js";

const ca = "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----";

test("ssl returns sslmode require", () => {
	strictEqual(getSsl(ca).sslmode, "require");
});

test("ssl returns rejectUnauthorized true", () => {
	strictEqual(getSsl(ca).ssl.rejectUnauthorized, true);
});

test("ssl passes ca through", () => {
	strictEqual(getSsl(ca).ssl.ca, ca);
});

test("ssl exposes checkServerIdentity function", () => {
	strictEqual(typeof getSsl(ca).ssl.checkServerIdentity, "function");
});

test("checkServerIdentity returns undefined when TLS check passes", () => {
	const { checkServerIdentity } = getSsl(ca).ssl;
	const cert = {
		subject: { CN: "db.cluster.us-east-1.rds.amazonaws.com" },
		subjectaltname: "DNS:db.cluster.us-east-1.rds.amazonaws.com",
	};
	const result = checkServerIdentity(
		"db.cluster.us-east-1.rds.amazonaws.com",
		cert,
	);
	strictEqual(result, undefined);
});

test("checkServerIdentity suppresses TLS error when cert CN is an RDS endpoint", () => {
	const { checkServerIdentity } = getSsl(ca).ssl;
	// No subjectaltname so node:tls falls back to CN check, which fails (host mismatch)
	const cert = { subject: { CN: "db.cluster.us-east-1.rds.amazonaws.com" } };
	const result = checkServerIdentity("evil.example.com", cert);
	strictEqual(result, undefined);
});

test("checkServerIdentity returns TLS error when cert CN is not an RDS endpoint", () => {
	const { checkServerIdentity } = getSsl(ca).ssl;
	const cert = { subject: { CN: "evil.example.com" } };
	const result = checkServerIdentity(
		"db.cluster.us-east-1.rds.amazonaws.com",
		cert,
	);
	ok(result instanceof Error);
});

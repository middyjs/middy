import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import getSsl from "./ssl.js";

const ca = "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----";

const setRegion = (value) => {
	if (value === undefined) {
		Reflect.deleteProperty(process.env, "AWS_REGION");
	} else {
		process.env.AWS_REGION = value;
	}
};

test("ssl does not include sslmode", () => {
	strictEqual("sslmode" in getSsl(ca), false);
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

test("checkServerIdentity suppresses TLS error for an in-region RDS endpoint (custom DNS)", () => {
	const previousRegion = process.env.AWS_REGION;
	setRegion("us-east-1");
	try {
		const { checkServerIdentity } = getSsl(ca).ssl;
		// No subjectaltname so node:tls falls back to CN check, which fails (host mismatch).
		// The cert is for an RDS endpoint in the configured region, so the error is suppressed
		// to support a custom DNS name / CNAME in front of the in-region instance.
		const cert = { subject: { CN: "db.cluster.us-east-1.rds.amazonaws.com" } };
		const result = checkServerIdentity("custom.db.example.com", cert);
		strictEqual(result, undefined);
	} finally {
		setRegion(previousRegion);
	}
});

test("checkServerIdentity returns TLS error for an out-of-region RDS endpoint", () => {
	const previousRegion = process.env.AWS_REGION;
	setRegion("us-east-1");
	try {
		const { checkServerIdentity } = getSsl(ca).ssl;
		// Cert is a valid RDS endpoint but in a different region than configured, so the
		// host-mismatch error must NOT be suppressed (prevents redirection to another
		// account's/region's RDS instance).
		const cert = { subject: { CN: "db.cluster.eu-west-1.rds.amazonaws.com" } };
		const result = checkServerIdentity("custom.db.example.com", cert);
		ok(result instanceof Error);
	} finally {
		setRegion(previousRegion);
	}
});

test("checkServerIdentity falls back to the bare RDS suffix when AWS_REGION is unset", () => {
	const previousRegion = process.env.AWS_REGION;
	setRegion(undefined);
	try {
		const { checkServerIdentity } = getSsl(ca).ssl;
		const cert = { subject: { CN: "db.cluster.us-east-1.rds.amazonaws.com" } };
		const result = checkServerIdentity("custom.db.example.com", cert);
		strictEqual(result, undefined);
	} finally {
		setRegion(previousRegion);
	}
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

test("checkServerIdentity returns TLS error without throwing when cert has no subject", () => {
	// Exercises the optional chain on cert.subject?.CN: a cert lacking `subject`
	// must surface the TLS error, not throw a TypeError reading .CN of undefined.
	const { checkServerIdentity } = getSsl(ca).ssl;
	const cert = {};
	const result = checkServerIdentity(
		"db.cluster.us-east-1.rds.amazonaws.com",
		cert,
	);
	ok(result instanceof Error);
});

test("checkServerIdentity returns TLS error without throwing when cert has no CN", () => {
	const { checkServerIdentity } = getSsl(ca).ssl;
	const cert = { subject: {} };
	const result = checkServerIdentity(
		"db.cluster.us-east-1.rds.amazonaws.com",
		cert,
	);
	ok(result instanceof Error);
});

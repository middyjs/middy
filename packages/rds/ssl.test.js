// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { checkServerIdentity } from "node:tls";
import getSsl from "./ssl.js";

const ca = "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----";
const servername = "db.cluster-id.us-east-1.rds.amazonaws.com";

test("ssl does not include sslmode", () => {
	strictEqual("sslmode" in getSsl(ca), false);
});

test("ssl returns rejectUnauthorized true", () => {
	strictEqual(getSsl(ca).ssl.rejectUnauthorized, true);
});

test("ssl passes ca through", () => {
	strictEqual(getSsl(ca).ssl.ca, ca);
});

test("ssl does not override checkServerIdentity", () => {
	strictEqual("checkServerIdentity" in getSsl(ca).ssl, false);
});

test("ssl omits servername when not provided", () => {
	strictEqual("servername" in getSsl(ca).ssl, false);
});

test("ssl omits servername when options are empty", () => {
	strictEqual("servername" in getSsl(ca, {}).ssl, false);
});

test("ssl returns servername when provided", () => {
	strictEqual(getSsl(ca, { servername }).ssl.servername, servername);
});

test("ssl keeps rejectUnauthorized and ca when servername is provided", () => {
	const { ssl } = getSsl(ca, { servername });
	strictEqual(ssl.rejectUnauthorized, true);
	strictEqual(ssl.ca, ca);
});

// Node's tls verifies the peer certificate against `servername`, so a
// certificate issued to a different RDS instance in the same region no
// longer passes when connecting through a CNAME.
test("tls.checkServerIdentity rejects a certificate for another RDS instance", () => {
	const cert = {
		subject: { CN: "other.cluster-id.us-east-1.rds.amazonaws.com" },
		subjectaltname: "DNS:other.cluster-id.us-east-1.rds.amazonaws.com",
	};
	ok(checkServerIdentity(servername, cert) instanceof Error);
});

test("tls.checkServerIdentity accepts a certificate whose SAN matches servername", () => {
	const cert = {
		subject: { CN: servername },
		subjectaltname: `DNS:${servername}`,
	};
	strictEqual(checkServerIdentity(servername, cert), undefined);
});

// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { ok, strictEqual } from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, mock, test } from "node:test";
import tls, { checkServerIdentity } from "node:tls";
import pg from "pg";
import getSsl from "./ssl.js";

const ca = "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----";
const servername = "db.cluster-id.us-east-1.rds.amazonaws.com";
const cname = "db.example.com";

describe("@middy/rds/ssl", () => {
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

	// pg's Connection#upgradeToSSL overwrites `servername` with the connection
	// host after merging the ssl object (node_modules/pg/lib/connection.js), so
	// the explicit name is never what Node verifies the certificate against. The
	// identity check must be pinned to `servername` instead.
	const upgradePgConnection = (ssl, host) => {
		const captured = [];
		mock.method(tls, "connect", (options) => {
			captured.push(options);
			return new EventEmitter();
		});
		try {
			const connection = new pg.Connection({ ssl, stream: new EventEmitter() });
			connection.upgradeToSSL(host, () => {});
		} finally {
			mock.restoreAll();
		}
		strictEqual(captured.length, 1);
		return captured[0];
	};

	test("pg overwrites servername with the connection host", () => {
		const options = upgradePgConnection(getSsl(ca, { servername }).ssl, cname);
		strictEqual(options.servername, cname);
	});

	test("pg verifies the certificate against the configured servername", () => {
		const options = upgradePgConnection(getSsl(ca, { servername }).ssl, cname);
		const cert = {
			subject: { CN: servername },
			subjectaltname: `DNS:${servername}`,
		};
		strictEqual(
			options.checkServerIdentity(options.servername, cert),
			undefined,
		);
	});

	test("pg rejects a certificate issued to the CNAME host, not the servername", () => {
		const options = upgradePgConnection(getSsl(ca, { servername }).ssl, cname);
		const cert = {
			subject: { CN: cname },
			subjectaltname: `DNS:${cname}`,
		};
		ok(options.checkServerIdentity(options.servername, cert) instanceof Error);
	});

	test("pg rejects a certificate for another RDS instance", () => {
		const options = upgradePgConnection(getSsl(ca, { servername }).ssl, cname);
		const cert = {
			subject: { CN: "other.cluster-id.us-east-1.rds.amazonaws.com" },
			subjectaltname: "DNS:other.cluster-id.us-east-1.rds.amazonaws.com",
		};
		ok(options.checkServerIdentity(options.servername, cert) instanceof Error);
	});

	test("pg keeps Node's default identity check without servername", () => {
		const options = upgradePgConnection(getSsl(ca).ssl, servername);
		strictEqual(options.servername, servername);
		strictEqual("checkServerIdentity" in options, false);
		strictEqual(options.rejectUnauthorized, true);
		strictEqual(options.ca, ca);
	});
});

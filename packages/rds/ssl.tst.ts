/// <reference types="node" />
import type { PeerCertificate } from "node:tls";
import { expect, test } from "tstyche";
import ssl, { type SslConfig, type SslOptions } from "./ssl.js";

const ca = "-----BEGIN CERTIFICATE-----";

test("ssl accepts a ca only", () => {
	expect(ssl(ca)).type.toBe<SslConfig>();
});

test("ssl accepts a servername option", () => {
	const options: SslOptions = {
		servername: "db.cluster-id.us-east-1.rds.amazonaws.com",
	};
	expect(ssl(ca, options)).type.toBe<SslConfig>();
	expect(ssl(ca, { servername: "db.example.com" }).ssl.servername).type.toBe<
		string | undefined
	>();
});

test("ssl rejects unknown options", () => {
	expect(ssl).type.not.toBeCallableWith(ca, { checkServerIdentity: () => {} });
});

test("ssl config pins checkServerIdentity to servername", () => {
	expect(
		ssl(ca, { servername: "db.example.com" }).ssl.checkServerIdentity,
	).type.toBe<
		((hostname: string, cert: PeerCertificate) => Error | undefined) | undefined
	>();
});

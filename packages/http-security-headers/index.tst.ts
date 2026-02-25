import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpSecurityHeaders from "./index.js";

test("use with default options", () => {
	const middleware = httpSecurityHeaders();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = httpSecurityHeaders({
		dnsPrefetchControl: {
			allow: true,
		},
		frameOptions: {
			action: "SAMEORIGIN",
		},
		poweredBy: true,
		strictTransportSecurity: {
			maxAge: 60 * 60 * 10,
			includeSubDomains: true,
			preload: true,
		},
		downloadOptions: {
			action: "noopen",
		},
		contentTypeOptions: {
			action: "nosniff",
		},
		originAgentCluster: true,
		referrerPolicy: {
			policy: "same-origin",
		},
		xssProtection: true,
		contentSecurityPolicy: {
			"default-src": "'none'",
			sandbox: "",
		},
		contentSecurityPolicyReportOnly: true,
		crossOriginEmbedderPolicy: {
			policy: "require-corp",
		},
		crossOriginOpenerPolicy: {
			policy: "same-origin",
		},
		crossOriginResourcePolicy: {
			policy: "same-origin",
		},
		permissionsPolicy: {
			"ambient-light-sensor": "",
		},
		reportingEndpoints: { default: "https://example.com/report" },
		permittedCrossDomainPolicies: {
			policy: "none",
		},
		reportTo: {
			maxAge: 365 * 24 * 60 * 60,
			default: "",
			includeSubdomains: true,
			csp: "",
			staple: "",
			xss: "",
		},
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("allow false options", () => {
	const middleware = httpSecurityHeaders({
		dnsPrefetchControl: false,
		frameOptions: false,
		poweredBy: false,
		strictTransportSecurity: false,
		downloadOptions: false,
		contentTypeOptions: false,
		originAgentCluster: false,
		referrerPolicy: false,
		xssProtection: false,
	});

	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("allow true options", () => {
	const middleware = httpSecurityHeaders({
		poweredBy: true,
	});

	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

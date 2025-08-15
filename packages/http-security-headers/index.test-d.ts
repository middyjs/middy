import type middy from "@middy/core";
import { expect } from "tstyche";
import httpSecurityHeaders from "./index.js";

// use with default options
let middleware = httpSecurityHeaders();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = httpSecurityHeaders({
	dnsPrefetchControl: {
		allow: true,
	},
	frameOptions: {
		action: "SAMEORIGIN",
	},
	poweredBy: {
		server: "middy",
	},
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
	xssProtection: {
		reportUri: "xss",
	},
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

// allow false options
middleware = httpSecurityHeaders({
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

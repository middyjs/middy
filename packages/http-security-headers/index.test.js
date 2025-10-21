import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpSecurityHeaders from "./index.js";

// const event = {}
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const createDefaultObjectResponse = () =>
	Object.assign(
		{},
		{
			statusCode: 200,
			body: { firstname: "john", lastname: "doe" },
		},
	);

const createHtmlObjectResponse = () =>
	Object.assign(
		{},
		{
			statusCode: 200,
			body: "<html></html>",
			headers: {
				"Content-Type": "text/html; charset=utf-8",
			},
		},
	);

const createHeaderObjectResponse = () =>
	Object.assign(
		{},
		{
			statusCode: 200,
			body: { firstname: "john", lastname: "doe" },
			headers: {
				Server: "AMZN",
				"X-Powered-By": "MiddyJS",
			},
		},
	);

const createArrayResponse = () => [{ firstname: "john", lastname: "doe" }];

test("It should return default security headers", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	equal(response.statusCode, 200);

	equal(response.headers["Origin-Agent-Cluster"], "?1");
	equal(response.headers["Referrer-Policy"], "no-referrer");
	equal(response.headers.Server, undefined);
	equal(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000; includeSubDomains; preload",
	);
	equal(response.headers["X-Content-Type-Options"], "nosniff");
	equal(response.headers["X-DNS-Prefetch-Control"], "off");
	equal(response.headers["X-Download-Options"], "noopen");
	equal(response.headers["X-Permitted-Cross-Domain-Policies"], "none");
	equal(response.headers["X-Powered-By"], undefined);
	equal(response.headers["X-Frame-Options"], undefined);
	equal(response.headers["X-XSS-Protection"], undefined);
});

test("It should return default security headers when HTML", async (t) => {
	const handler = middy(() => createHtmlObjectResponse());

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	equal(
		response.headers["Content-Security-Policy"],
		"default-src 'none' 'report-sample' 'report-sha256'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; navigate-to 'none'; report-to default; require-trusted-types-for 'script'; trusted-types 'none'; sandbox; upgrade-insecure-requests",
	);
	equal(response.headers["Cross-Origin-Embedder-Policy"], "require-corp");
	equal(response.headers["Cross-Origin-Opener-Policy"], "same-origin");
	equal(response.headers["Cross-Origin-Resource-Policy"], "same-origin");
	equal(response.headers["Origin-Agent-Cluster"], "?1");
	equal(
		response.headers["Permissions-Policy"],
		"accelerometer=(), all-screens-capture=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=(), clipboard-read=(), clipboard-write=(), gamepad=(), speaker-selection=(), conversion-measurement=(), focus-without-user-activation=(), hid=(), idle-detection=(), interest-cohort=(), serial=(), sync-script=(), trust-token-redemption=(), window-placement=(), vertical-scroll=()",
	);
	equal(response.headers["Referrer-Policy"], "no-referrer");
	equal(response.headers.Server, undefined);
	equal(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000; includeSubDomains; preload",
	);
	equal(response.headers["X-Content-Type-Options"], "nosniff");
	equal(response.headers["X-DNS-Prefetch-Control"], "off");
	equal(response.headers["X-Download-Options"], "noopen");
	equal(response.headers["X-Permitted-Cross-Domain-Policies"], "none");
	equal(response.headers["X-Powered-By"], undefined);
	equal(response.headers["X-Frame-Options"], "DENY");
	equal(response.headers["X-XSS-Protection"], undefined);
});

test("It should modify default security headers", async (t) => {
	const handler = middy(() => createHeaderObjectResponse());

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	equal(response.statusCode, 200);
	equal(response.headers.Server, undefined);
	equal(response.headers["X-Powered-By"], undefined);
});

test("It should modify default security headers with config set", async (t) => {
	const handler = middy(() => createHtmlObjectResponse());

	handler.use(
		httpSecurityHeaders({
			contentSecurityPolicy: false,
			dnsPrefetchControl: {
				allow: true,
			},
			referrerPolicy: undefined,
			strictTransportSecurity: {
				includeSubDomains: false,
				preload: false,
			},
			poweredBy: true,
			permissionsPolicy: {
				accelerometer: "*",
			},
			permittedCrossDomainPolicies: {
				policy: "all",
			},
			xssProtection: true,
			reportTo: {
				default: "https://example.report-uri.com/a/d/g",
			},
			reportingEndpoints: {
				csp: "https://example.report-uri.com/a/d/g",
				perms: "https://example.report-uri.com/a/d/g",
			},
		}),
	);

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	equal(response.statusCode, 200);
	equal(response.headers["Content-Security-Policy"], undefined);
	equal(response.headers["Referrer-Policy"], undefined);

	equal(
		response.headers["Reporting-Endpoints"],
		'csp="https://example.report-uri.com/a/d/g", perms="https://example.report-uri.com/a/d/g"',
	);
	equal(
		response.headers["Report-To"],
		'{ "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://example.report-uri.com/a/d/g" } ], "include_subdomains": true }',
	);
	equal(
		response.headers["Permissions-Policy"],
		"accelerometer=*, all-screens-capture=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=(), clipboard-read=(), clipboard-write=(), gamepad=(), speaker-selection=(), conversion-measurement=(), focus-without-user-activation=(), hid=(), idle-detection=(), interest-cohort=(), serial=(), sync-script=(), trust-token-redemption=(), window-placement=(), vertical-scroll=()",
	);
	equal(response.headers.Server, undefined);
	equal(response.headers["Strict-Transport-Security"], "max-age=15552000");
	equal(response.headers["X-DNS-Prefetch-Control"], "on");
	equal(response.headers["X-Permitted-Cross-Domain-Policies"], "all");
	equal(response.headers["X-Powered-By"], undefined);
	equal(response.headers["X-XSS-Protection"], "0");
});

test("It should support array responses", async (t) => {
	const handler = middy(() => createArrayResponse());

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	deepEqual(response.body, [{ firstname: "john", lastname: "doe" }]);
	equal(response.statusCode, 200);
	equal(response.headers["Referrer-Policy"], "no-referrer");
	equal(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000; includeSubDomains; preload",
	);
	equal(response.headers["X-DNS-Prefetch-Control"], "off");
	equal(response.headers["X-Powered-By"], undefined);
	equal(response.headers["X-Download-Options"], "noopen");
	equal(response.headers["X-Content-Type-Options"], "nosniff");
	equal(response.headers["X-Permitted-Cross-Domain-Policies"], "none");

	equal(response.headers["X-Frame-Options"], undefined);
	equal(response.headers["X-XSS-Protection"], undefined);
});

test("It should skip onError if error has not been handled", async (t) => {
	const handler = middy(() => {
		throw new Error("error");
	});

	handler
		.onError((request) => {
			equal(request.response, undefined);
			request.response = true;
		})
		.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	await handler(event, defaultContext);
});

test("It should apply security headers if error is handled", async (t) => {
	const handler = middy(() => {
		throw new Error("error");
	});

	handler.use(httpSecurityHeaders()).onError((request) => {
		request.response = {
			statusCode: 500,
		};
	});

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	equal(response.statusCode, 500);

	equal(response.headers["Origin-Agent-Cluster"], "?1");
	equal(response.headers["Referrer-Policy"], "no-referrer");
	equal(response.headers.Server, undefined);
	equal(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000; includeSubDomains; preload",
	);
	equal(response.headers["X-Content-Type-Options"], "nosniff");
	equal(response.headers["X-DNS-Prefetch-Control"], "off");
	equal(response.headers["X-Download-Options"], "noopen");
	equal(response.headers["X-Permitted-Cross-Domain-Policies"], "none");
	equal(response.headers["X-Powered-By"], undefined);
	equal(response.headers["X-Frame-Options"], undefined);
	equal(response.headers["X-XSS-Protection"], undefined);
});

test("It should support report only mode", async (t) => {
	const handler = middy(() => createHtmlObjectResponse());

	handler.use(
		httpSecurityHeaders({
			contentSecurityPolicy: {},
			contentSecurityPolicyReportOnly: true,
		}),
	);

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	equal(response.statusCode, 200);
	equal(response.headers["Content-Security-Policy"], undefined);
	equal(
		response.headers["Content-Security-Policy-Report-Only"],
		"default-src 'none' 'report-sample' 'report-sha256'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; navigate-to 'none'; report-to default; require-trusted-types-for 'script'; trusted-types 'none'; sandbox; upgrade-insecure-requests",
	);
});

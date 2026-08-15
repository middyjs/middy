import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpSecurityHeaders, {
	httpSecurityHeadersValidateOptions,
} from "./index.js";

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
			body: '<html lang="en"></html>',
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

	strictEqual(response.statusCode, 200);

	strictEqual(
		response.headers["Content-Security-Policy"],
		"default-src 'report-sample' 'report-sha256'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; report-to default; require-trusted-types-for 'script'; sandbox; upgrade-insecure-requests",
	);
	strictEqual(response.headers["Cross-Origin-Embedder-Policy"], "require-corp");
	strictEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin");
	strictEqual(response.headers["Cross-Origin-Resource-Policy"], "same-origin");
	strictEqual(response.headers["Origin-Agent-Cluster"], "?1");
	strictEqual(response.headers["Referrer-Policy"], "no-referrer");
	strictEqual(response.headers.Server, undefined);
	strictEqual(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000; includeSubDomains",
	);
	strictEqual(response.headers["X-Content-Type-Options"], "nosniff");
	strictEqual(response.headers["X-DNS-Prefetch-Control"], "off");
	strictEqual(response.headers["X-Download-Options"], "noopen");
	strictEqual(response.headers["X-Frame-Options"], "DENY");
	strictEqual(response.headers["X-Permitted-Cross-Domain-Policies"], "none");
	strictEqual(response.headers["X-Powered-By"], undefined);
});

test("It should return default security headers when HTML", async (t) => {
	const handler = middy(() => createHtmlObjectResponse());

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["Content-Security-Policy"],
		"default-src 'report-sample' 'report-sha256'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; report-to default; require-trusted-types-for 'script'; sandbox; upgrade-insecure-requests",
	);
	strictEqual(response.headers["Cross-Origin-Embedder-Policy"], "require-corp");
	strictEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin");
	strictEqual(response.headers["Cross-Origin-Resource-Policy"], "same-origin");
	strictEqual(response.headers["Origin-Agent-Cluster"], "?1");
	strictEqual(
		response.headers["Permissions-Policy"],
		"accelerometer=(), all-screens-capture=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), monetization=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=(), clipboard-read=(), clipboard-write=(), gamepad=(), speaker-selection=(), conversion-measurement=(), focus-without-user-activation=(), hid=(), idle-detection=(), interest-cohort=(), serial=(), sync-script=(), trust-token-redemption=(), window-placement=(), vertical-scroll=()",
	);
	strictEqual(response.headers["Referrer-Policy"], "no-referrer");
	strictEqual(response.headers.Server, undefined);
	strictEqual(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000; includeSubDomains",
	);
	strictEqual(response.headers["X-Content-Type-Options"], "nosniff");
	strictEqual(response.headers["X-DNS-Prefetch-Control"], "off");
	strictEqual(response.headers["X-Download-Options"], "noopen");
	strictEqual(response.headers["X-Permitted-Cross-Domain-Policies"], "none");
	strictEqual(response.headers["X-Powered-By"], undefined);
	strictEqual(response.headers["X-Frame-Options"], "DENY");
	strictEqual(response.headers["X-XSS-Protection"], undefined);
});

test("It should modify default security headers", async (t) => {
	const handler = middy(() => createHeaderObjectResponse());

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 200);
	strictEqual(response.headers.Server, undefined);
	strictEqual(response.headers["X-Powered-By"], undefined);
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

	strictEqual(response.statusCode, 200);
	strictEqual(response.headers["Content-Security-Policy"], undefined);
	strictEqual(response.headers["Referrer-Policy"], undefined);

	strictEqual(
		response.headers["Reporting-Endpoints"],
		'csp="https://example.report-uri.com/a/d/g", perms="https://example.report-uri.com/a/d/g"',
	);
	strictEqual(
		response.headers["Report-To"],
		'{ "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://example.report-uri.com/a/d/g" } ], "include_subdomains": true }',
	);
	strictEqual(
		response.headers["Permissions-Policy"],
		"accelerometer=*, all-screens-capture=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), monetization=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=(), clipboard-read=(), clipboard-write=(), gamepad=(), speaker-selection=(), conversion-measurement=(), focus-without-user-activation=(), hid=(), idle-detection=(), interest-cohort=(), serial=(), sync-script=(), trust-token-redemption=(), window-placement=(), vertical-scroll=()",
	);
	strictEqual(response.headers.Server, undefined);
	strictEqual(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000",
	);
	strictEqual(response.headers["X-DNS-Prefetch-Control"], "on");
	strictEqual(response.headers["X-Permitted-Cross-Domain-Policies"], "all");
	strictEqual(response.headers["X-Powered-By"], undefined);
	strictEqual(response.headers["X-XSS-Protection"], "0");
});

test("It should support array responses", async (t) => {
	const handler = middy(() => createArrayResponse());

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response.body, [{ firstname: "john", lastname: "doe" }]);
	strictEqual(response.statusCode, 200);
	strictEqual(response.headers["Cross-Origin-Embedder-Policy"], "require-corp");
	strictEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin");
	strictEqual(response.headers["Cross-Origin-Resource-Policy"], "same-origin");
	strictEqual(response.headers["Referrer-Policy"], "no-referrer");
	strictEqual(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000; includeSubDomains",
	);
	strictEqual(response.headers["X-Content-Type-Options"], "nosniff");
	strictEqual(response.headers["X-DNS-Prefetch-Control"], "off");
	strictEqual(response.headers["X-Download-Options"], "noopen");
	strictEqual(response.headers["X-Frame-Options"], "DENY");
	strictEqual(response.headers["X-Permitted-Cross-Domain-Policies"], "none");
	strictEqual(response.headers["X-Powered-By"], undefined);
});

test("It should skip onError if error has not been handled", async (t) => {
	const handler = middy(() => {
		throw new Error("error");
	});

	handler
		.onError((request) => {
			strictEqual(request.response, undefined);
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

	strictEqual(response.statusCode, 500);

	strictEqual(response.headers["Cross-Origin-Embedder-Policy"], "require-corp");
	strictEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin");
	strictEqual(response.headers["Cross-Origin-Resource-Policy"], "same-origin");
	strictEqual(response.headers["Origin-Agent-Cluster"], "?1");
	strictEqual(response.headers["Referrer-Policy"], "no-referrer");
	strictEqual(response.headers.Server, undefined);
	strictEqual(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000; includeSubDomains",
	);
	strictEqual(response.headers["X-Content-Type-Options"], "nosniff");
	strictEqual(response.headers["X-DNS-Prefetch-Control"], "off");
	strictEqual(response.headers["X-Download-Options"], "noopen");
	strictEqual(response.headers["X-Frame-Options"], "DENY");
	strictEqual(response.headers["X-Permitted-Cross-Domain-Policies"], "none");
	strictEqual(response.headers["X-Powered-By"], undefined);
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

	strictEqual(response.statusCode, 200);
	strictEqual(response.headers["Content-Security-Policy"], undefined);
	strictEqual(
		response.headers["Content-Security-Policy-Report-Only"],
		"default-src 'report-sample' 'report-sha256'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; report-to default; require-trusted-types-for 'script'; sandbox; upgrade-insecure-requests",
	);
});

test("It should apply all headers regardless of content type", async (t) => {
	const handler = middy(() => ({
		statusCode: 200,
		body: "{}",
		headers: { "Content-Type": "application/json" },
	}));

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 200);
	strictEqual(response.headers["X-Frame-Options"], "DENY");
	strictEqual(response.headers["Cross-Origin-Embedder-Policy"], "require-corp");
	strictEqual(response.headers["Referrer-Policy"], "no-referrer");
	strictEqual(response.headers["X-Content-Type-Options"], "nosniff");
});

test("It should handle reportTo with non-default group", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
	}));

	handler.use(
		httpSecurityHeaders({
			reportTo: {
				default: "https://default.example.com",
				custom: "https://custom.example.com",
			},
		}),
	);

	const event = { httpMethod: "GET" };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 200);
	strictEqual(
		response.headers["Report-To"],
		'{ "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://default.example.com" } ], "include_subdomains": true }, { "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://custom.example.com" } ] }',
	);
});

test("It should handle reportTo with falsy group value", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
	}));

	handler.use(
		httpSecurityHeaders({
			reportTo: {
				default: "https://default.example.com",
				disabled: "",
			},
		}),
	);

	const event = { httpMethod: "GET" };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 200);
	strictEqual(
		response.headers["Report-To"],
		'{ "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://default.example.com" } ], "include_subdomains": true }',
	);
});

test("It should not emit preload when maxAge is below one year", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["Strict-Transport-Security"],
		"max-age=15552000; includeSubDomains",
	);
});

test("It should emit preload when maxAge is at least one year", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(
		httpSecurityHeaders({
			strictTransportSecurity: {
				maxAge: 31536000,
				preload: true,
			},
		}),
	);

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["Strict-Transport-Security"],
		"max-age=31536000; includeSubDomains; preload",
	);
});

test("It should honor a Report-To includeSubDomains override", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(
		httpSecurityHeaders({
			reportTo: {
				default: "https://default.example.com",
				includeSubDomains: false,
			},
		}),
	);

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["Report-To"],
		'{ "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://default.example.com" } ], "include_subdomains": false }',
	);
});

test("It should honor a Report-To legacy includeSubdomains override", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(
		httpSecurityHeaders({
			reportTo: {
				default: "https://default.example.com",
				includeSubdomains: false,
			},
		}),
	);

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["Report-To"],
		'{ "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://default.example.com" } ], "include_subdomains": false }',
	);
});

test("It should not emit empty Report-To or Reporting-Endpoints headers by default", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpSecurityHeaders());

	const event = {
		httpMethod: "GET",
	};

	const response = await handler(event, defaultContext);

	strictEqual(response.headers["Report-To"], undefined);
	strictEqual(response.headers["Reporting-Endpoints"], undefined);
});

test("httpSecurityHeadersValidateOptions accepts valid options and rejects typos", () => {
	httpSecurityHeadersValidateOptions({
		poweredBy: false,
		frameOptions: { action: "deny" },
		xssProtection: false,
	});
	httpSecurityHeadersValidateOptions({});
	try {
		httpSecurityHeadersValidateOptions({ fraemOptions: {} });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-security-headers");
	}
});

test("httpSecurityHeadersValidateOptions rejects wrong type", () => {
	try {
		httpSecurityHeadersValidateOptions({ frameOptions: "deny" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("frameOptions"));
	}
});

test("httpSecurityHeadersValidateOptions rejects unknown referrerPolicy value", () => {
	try {
		httpSecurityHeadersValidateOptions({
			referrerPolicy: { policy: "bogus" },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("httpSecurityHeadersValidateOptions accepts known referrerPolicy value", () => {
	httpSecurityHeadersValidateOptions({
		referrerPolicy: { policy: "strict-origin-when-cross-origin" },
	});
});

test("httpSecurityHeadersValidateOptions rejects unknown nested property", () => {
	try {
		httpSecurityHeadersValidateOptions({
			strictTransportSecurity: { maxAge: 10, includeSubDomians: true },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

const assertRejects = (options) => {
	try {
		httpSecurityHeadersValidateOptions(options);
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
};

test("httpSecurityHeadersValidateOptions accepts a valid policy option value", () => {
	httpSecurityHeadersValidateOptions({
		crossOriginEmbedderPolicy: { policy: "require-corp" },
		crossOriginOpenerPolicy: { policy: "same-origin" },
		crossOriginResourcePolicy: { policy: "same-origin" },
	});
});

test("httpSecurityHeadersValidateOptions accepts a valid contentSecurityPolicy object", () => {
	httpSecurityHeadersValidateOptions({
		contentSecurityPolicy: { "default-src": "'self'" },
	});
});

test("httpSecurityHeadersValidateOptions accepts a boolean contentSecurityPolicyReportOnly", () => {
	httpSecurityHeadersValidateOptions({ contentSecurityPolicyReportOnly: true });
});

test("httpSecurityHeadersValidateOptions accepts a valid dnsPrefetchControl object", () => {
	httpSecurityHeadersValidateOptions({ dnsPrefetchControl: { allow: true } });
});

test("httpSecurityHeadersValidateOptions accepts a valid originAgentCluster object", () => {
	httpSecurityHeadersValidateOptions({ originAgentCluster: {} });
});

test("httpSecurityHeadersValidateOptions accepts a valid permissionsPolicy object", () => {
	httpSecurityHeadersValidateOptions({ permissionsPolicy: { camera: "" } });
});

test("httpSecurityHeadersValidateOptions accepts a valid reportingEndpoints object", () => {
	httpSecurityHeadersValidateOptions({
		reportingEndpoints: { csp: "https://example.com" },
	});
});

test("httpSecurityHeadersValidateOptions accepts a valid reportTo object", () => {
	httpSecurityHeadersValidateOptions({
		reportTo: { default: "https://example.com" },
	});
});

test("httpSecurityHeadersValidateOptions accepts a valid strictTransportSecurity object", () => {
	httpSecurityHeadersValidateOptions({
		strictTransportSecurity: {
			maxAge: 100,
			includeSubDomains: true,
			preload: false,
		},
	});
});

test("httpSecurityHeadersValidateOptions rejects extra property on a policy option", () => {
	assertRejects({ crossOriginOpenerPolicy: { policy: "same-origin", x: 1 } });
});

test("httpSecurityHeadersValidateOptions rejects non-string policy value", () => {
	assertRejects({ crossOriginOpenerPolicy: { policy: 1 } });
});

test("httpSecurityHeadersValidateOptions rejects extra property on an action option", () => {
	assertRejects({ contentTypeOptions: { action: "nosniff", x: 1 } });
});

test("httpSecurityHeadersValidateOptions accepts every referrerPolicy enum value", () => {
	for (const policy of [
		"no-referrer",
		"no-referrer-when-downgrade",
		"origin",
		"origin-when-cross-origin",
		"same-origin",
		"strict-origin",
		"strict-origin-when-cross-origin",
		"unsafe-url",
	]) {
		httpSecurityHeadersValidateOptions({ referrerPolicy: { policy } });
	}
});

test("httpSecurityHeadersValidateOptions accepts every permittedCrossDomainPolicies enum value", () => {
	for (const policy of [
		"none",
		"master-only",
		"by-content-type",
		"by-ftp-filename",
		"all",
	]) {
		httpSecurityHeadersValidateOptions({
			permittedCrossDomainPolicies: { policy },
		});
	}
});

test("httpSecurityHeadersValidateOptions rejects unknown permittedCrossDomainPolicies value", () => {
	assertRejects({ permittedCrossDomainPolicies: { policy: "bogus" } });
});

test("httpSecurityHeadersValidateOptions rejects non-object contentSecurityPolicy", () => {
	assertRejects({ contentSecurityPolicy: 1 });
});

test("httpSecurityHeadersValidateOptions rejects non-boolean contentSecurityPolicyReportOnly", () => {
	assertRejects({ contentSecurityPolicyReportOnly: 1 });
});

test("httpSecurityHeadersValidateOptions rejects invalid dnsPrefetchControl shape", () => {
	assertRejects({ dnsPrefetchControl: 1 });
});

test("httpSecurityHeadersValidateOptions rejects non-boolean dnsPrefetchControl.allow", () => {
	assertRejects({ dnsPrefetchControl: { allow: 1 } });
});

test("httpSecurityHeadersValidateOptions rejects extra property on dnsPrefetchControl", () => {
	assertRejects({ dnsPrefetchControl: { allow: true, x: 1 } });
});

test("httpSecurityHeadersValidateOptions rejects invalid originAgentCluster shape", () => {
	assertRejects({ originAgentCluster: 1 });
});

test("httpSecurityHeadersValidateOptions rejects extra property on originAgentCluster", () => {
	assertRejects({ originAgentCluster: { x: 1 } });
});

test("httpSecurityHeadersValidateOptions rejects non-object permissionsPolicy", () => {
	assertRejects({ permissionsPolicy: 1 });
});

test("httpSecurityHeadersValidateOptions rejects non-object reportingEndpoints", () => {
	assertRejects({ reportingEndpoints: 1 });
});

test("httpSecurityHeadersValidateOptions rejects non-object reportTo", () => {
	assertRejects({ reportTo: 1 });
});

test("httpSecurityHeadersValidateOptions rejects invalid strictTransportSecurity shape", () => {
	assertRejects({ strictTransportSecurity: 1 });
});

test("httpSecurityHeadersValidateOptions rejects negative strictTransportSecurity.maxAge", () => {
	assertRejects({ strictTransportSecurity: { maxAge: -1 } });
});

test("httpSecurityHeadersValidateOptions rejects non-number strictTransportSecurity.maxAge", () => {
	assertRejects({ strictTransportSecurity: { maxAge: "100" } });
});

test("httpSecurityHeadersValidateOptions rejects non-boolean strictTransportSecurity.includeSubDomains", () => {
	assertRejects({ strictTransportSecurity: { includeSubDomains: 1 } });
});

test("httpSecurityHeadersValidateOptions rejects non-boolean strictTransportSecurity.preload", () => {
	assertRejects({ strictTransportSecurity: { preload: 1 } });
});

test("httpSecurityHeadersValidateOptions rejects extra property on xssProtection", () => {
	assertRejects({ xssProtection: { x: 1 } });
});

test("It should emit default preload when only maxAge is overridden above one year", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(
		httpSecurityHeaders({
			strictTransportSecurity: {
				maxAge: 31536000,
			},
		}),
	);

	const event = { httpMethod: "GET" };
	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["Strict-Transport-Security"],
		"max-age=31536000; includeSubDomains; preload",
	);
});

test("It should not append sandbox or upgrade-insecure-requests when directives are disabled", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(
		httpSecurityHeaders({
			contentSecurityPolicy: {
				"default-src": "'self'",
				sandbox: false,
				"upgrade-insecure-requests": false,
			},
		}),
	);

	const event = { httpMethod: "GET" };
	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["Content-Security-Policy"],
		"default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; report-to default; require-trusted-types-for 'script'",
	);
});

test("It should honor legacy includeSubdomains key as a setting not an endpoint group", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(
		httpSecurityHeaders({
			reportTo: {
				default: "https://default.example.com",
				includeSubdomains: true,
			},
		}),
	);

	const event = { httpMethod: "GET" };
	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["Report-To"],
		'{ "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://default.example.com" } ], "include_subdomains": true }',
	);
});

test("It should not remove Server or X-Powered-By when poweredBy is false", async (t) => {
	const handler = middy(() => createHeaderObjectResponse());

	handler.use(httpSecurityHeaders({ poweredBy: false }));

	const event = { httpMethod: "GET" };
	const response = await handler(event, defaultContext);

	strictEqual(response.headers.Server, "AMZN");
	strictEqual(response.headers["X-Powered-By"], "MiddyJS");
});

test("It should remove Server and X-Powered-By when present and poweredBy enabled", async (t) => {
	const handler = middy(() => createHeaderObjectResponse());

	handler.use(httpSecurityHeaders({ poweredBy: true }));

	const event = { httpMethod: "GET" };
	const response = await handler(event, defaultContext);

	ok(!("Server" in response.headers));
	ok(!("X-Powered-By" in response.headers));
});

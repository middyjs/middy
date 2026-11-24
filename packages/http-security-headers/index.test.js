import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { describe, test } from "node:test";
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

describe("@middy/http-security-headers", () => {
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
		strictEqual(
			response.headers["Cross-Origin-Embedder-Policy"],
			"require-corp",
		);
		strictEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin");
		strictEqual(
			response.headers["Cross-Origin-Resource-Policy"],
			"same-origin",
		);
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
		strictEqual(
			response.headers["Cross-Origin-Embedder-Policy"],
			"require-corp",
		);
		strictEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin");
		strictEqual(
			response.headers["Cross-Origin-Resource-Policy"],
			"same-origin",
		);
		strictEqual(response.headers["Origin-Agent-Cluster"], "?1");
		strictEqual(
			response.headers["Permissions-Policy"],
			"accelerometer=(), ambient-light-sensor=(), attribution-reporting=(), autoplay=(), battery=(), bluetooth=(), camera=(), ch-ua=(), ch-ua-arch=(), ch-ua-bitness=(), ch-ua-full-version=(), ch-ua-full-version-list=(), ch-ua-high-entropy-values=(), ch-ua-mobile=(), ch-ua-model=(), ch-ua-platform=(), ch-ua-platform-version=(), ch-ua-wow64=(), compute-pressure=(), cross-origin-isolated=(), direct-sockets=(), display-capture=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), identity-credentials-get=(), idle-detection=(), keyboard-map=(), magnetometer=(), mediasession=(), microphone=(), midi=(), navigation-override=(), otp-credentials=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), publickey-credentials-remote-client-data-json=(), screen-wake-lock=(), serial=(), sync-xhr=(), storage-access=(), tools=(), usb=(), web-share=(), window-management=(), xr-spatial-tracking=(), autofill=(), clipboard-read=(), clipboard-write=(), deferred-fetch=(), gamepad=(), language-detector=(), language-model=(), manual-text=(), rewriter=(), speaker-selection=(), summarizer=(), translator=(), haptics=(), writer=(), all-screens-capture=(), browsing-topics=(), captured-surface-control=(), conversion-measurement=(), digital-credentials-create=(), digital-credentials-get=(), focus-without-user-activation=(), join-ad-interest-group=(), local-fonts=(), monetization=(), run-ad-auction=(), smart-card=(), sync-script=(), trust-token-redemption=(), unload=(), vertical-scroll=()",
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
			"accelerometer=*, ambient-light-sensor=(), attribution-reporting=(), autoplay=(), battery=(), bluetooth=(), camera=(), ch-ua=(), ch-ua-arch=(), ch-ua-bitness=(), ch-ua-full-version=(), ch-ua-full-version-list=(), ch-ua-high-entropy-values=(), ch-ua-mobile=(), ch-ua-model=(), ch-ua-platform=(), ch-ua-platform-version=(), ch-ua-wow64=(), compute-pressure=(), cross-origin-isolated=(), direct-sockets=(), display-capture=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), identity-credentials-get=(), idle-detection=(), keyboard-map=(), magnetometer=(), mediasession=(), microphone=(), midi=(), navigation-override=(), otp-credentials=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), publickey-credentials-remote-client-data-json=(), screen-wake-lock=(), serial=(), sync-xhr=(), storage-access=(), tools=(), usb=(), web-share=(), window-management=(), xr-spatial-tracking=(), autofill=(), clipboard-read=(), clipboard-write=(), deferred-fetch=(), gamepad=(), language-detector=(), language-model=(), manual-text=(), rewriter=(), speaker-selection=(), summarizer=(), translator=(), haptics=(), writer=(), all-screens-capture=(), browsing-topics=(), captured-surface-control=(), conversion-measurement=(), digital-credentials-create=(), digital-credentials-get=(), focus-without-user-activation=(), join-ad-interest-group=(), local-fonts=(), monetization=(), run-ad-auction=(), smart-card=(), sync-script=(), trust-token-redemption=(), unload=(), vertical-scroll=()",
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
		strictEqual(
			response.headers["Cross-Origin-Embedder-Policy"],
			"require-corp",
		);
		strictEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin");
		strictEqual(
			response.headers["Cross-Origin-Resource-Policy"],
			"same-origin",
		);
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

		strictEqual(
			response.headers["Cross-Origin-Embedder-Policy"],
			"require-corp",
		);
		strictEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin");
		strictEqual(
			response.headers["Cross-Origin-Resource-Policy"],
			"same-origin",
		);
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
		strictEqual(
			response.headers["Cross-Origin-Embedder-Policy"],
			"require-corp",
		);
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
			'{ "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://default.example.com" } ], "include_subdomains": true }, { "group": "custom", "max_age": 31536000, "endpoints": [ { "url": "https://custom.example.com" } ] }',
		);
	});

	test("It should name each Report-To group after its key", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
		}));

		handler.use(
			httpSecurityHeaders({
				reportTo: {
					csp: "https://csp.example.com",
					default: "https://default.example.com",
				},
			}),
		);

		const event = { httpMethod: "GET" };
		const response = await handler(event, defaultContext);

		strictEqual(response.statusCode, 200);
		strictEqual(
			response.headers["Report-To"],
			'{ "group": "csp", "max_age": 31536000, "endpoints": [ { "url": "https://csp.example.com" } ] }, { "group": "default", "max_age": 31536000, "endpoints": [ { "url": "https://default.example.com" } ], "include_subdomains": true }',
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

		handler.use(
			httpSecurityHeaders({
				strictTransportSecurity: {
					maxAge: 31535999,
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
			"max-age=31535999; includeSubDomains",
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
		httpSecurityHeadersValidateOptions({
			contentSecurityPolicyReportOnly: true,
		});
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

	test("It should not emit preload when only maxAge is raised to one year", async (t) => {
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
			"max-age=31536000; includeSubDomains",
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
	test("It should remove Server and X-Powered-By in any casing", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			headers: { server: "AMZN", "x-powered-by": "MiddyJS", "X-Keep": "1" },
		}));

		handler.use(httpSecurityHeaders({ poweredBy: true }));

		const response = await handler({ httpMethod: "GET" }, defaultContext);

		const names = Object.keys(response.headers).map((k) => k.toLowerCase());
		ok(!names.includes("server"));
		ok(!names.includes("x-powered-by"));
		strictEqual(response.headers["X-Keep"], "1");
	});

	test("It should override a handler header set in another casing without duplicating it", async (t) => {
		// The middleware's value has always won over the handler's; that holds
		// whatever casing the handler used, and only one copy is sent.
		const handler = middy(() => ({
			statusCode: 200,
			headers: {
				"content-security-policy": "default-src *",
				"x-frame-options": "SAMEORIGIN",
			},
		}));

		handler.use(httpSecurityHeaders());

		const response = await handler({ httpMethod: "GET" }, defaultContext);

		const names = Object.keys(response.headers).map((k) => k.toLowerCase());
		strictEqual(names.filter((n) => n === "content-security-policy").length, 1);
		strictEqual(names.filter((n) => n === "x-frame-options").length, 1);
		strictEqual(response.headers["X-Frame-Options"], "DENY");
		ok(response.headers["Content-Security-Policy"] !== "default-src *");
	});

	// ALB with multi-value headers enabled only reads `multiValueHeaders`: "You
	// must use multiValueHeaders if you have enabled multi-value headers and
	// headers otherwise."
	// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
	const albMultiValueEvent = {
		httpMethod: "GET",
		requestContext: { elb: { targetGroupArn: "arn" } },
		multiValueHeaders: { accept: ["text/html"] },
	};

	test("It should write security headers into multiValueHeaders for an ALB multi-value event", async (t) => {
		const handler = middy(() => ({ statusCode: 200, body: "" }));
		handler.use(httpSecurityHeaders());

		const response = await handler(albMultiValueEvent, defaultContext);

		deepStrictEqual(response.multiValueHeaders["Strict-Transport-Security"], [
			"max-age=15552000; includeSubDomains",
		]);
		deepStrictEqual(response.multiValueHeaders["X-Frame-Options"], ["DENY"]);
		strictEqual(response.headers["Strict-Transport-Security"], undefined);
	});

	test("It should keep handler multiValueHeaders it does not own for an ALB multi-value event", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			multiValueHeaders: { "Set-Cookie": ["a=1", "b=2"] },
		}));
		handler.use(httpSecurityHeaders());

		const response = await handler(albMultiValueEvent, defaultContext);

		deepStrictEqual(response.multiValueHeaders["Set-Cookie"], ["a=1", "b=2"]);
		deepStrictEqual(response.multiValueHeaders["X-Frame-Options"], ["DENY"]);
	});

	test("It should not treat an ALB event without multiValueHeaders as multi-value", async (t) => {
		const handler = middy(() => ({ statusCode: 200, body: "" }));
		handler.use(httpSecurityHeaders());

		const response = await handler(
			{ httpMethod: "GET", requestContext: { elb: {} }, headers: {} },
			defaultContext,
		);

		strictEqual(response.multiValueHeaders, undefined);
		strictEqual(response.headers["X-Frame-Options"], "DENY");
	});

	test("It should not treat an API Gateway REST event with multiValueHeaders as ALB multi-value", async (t) => {
		const handler = middy(() => ({ statusCode: 200, body: "" }));
		handler.use(httpSecurityHeaders());

		const response = await handler(
			{ httpMethod: "GET", headers: {}, multiValueHeaders: {} },
			defaultContext,
		);

		strictEqual(response.multiValueHeaders, undefined);
		strictEqual(response.headers["X-Frame-Options"], "DENY");
	});

	// API Gateway REST merges both maps and "If the same key-value pair is
	// specified in both, only the values from multiValueHeaders will appear".
	// https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
	test("It should replace and strip handler multiValueHeaders in any casing", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			headers: { "X-Keep": "1" },
			multiValueHeaders: {
				"x-frame-options": ["SAMEORIGIN"],
				"X-Powered-By": ["MiddyJS"],
				server: ["AMZN"],
				"Set-Cookie": ["a=1"],
			},
		}));
		handler.use(httpSecurityHeaders({ poweredBy: true }));

		const response = await handler(
			{ httpMethod: "GET", headers: {}, multiValueHeaders: {} },
			defaultContext,
		);

		const names = Object.keys(response.multiValueHeaders).map((k) =>
			k.toLowerCase(),
		);
		strictEqual(names.filter((n) => n === "x-frame-options").length, 1);
		ok(!names.includes("x-powered-by"));
		ok(!names.includes("server"));
		deepStrictEqual(response.multiValueHeaders["X-Frame-Options"], ["DENY"]);
		deepStrictEqual(response.multiValueHeaders["Set-Cookie"], ["a=1"]);
		strictEqual(response.headers["X-Keep"], "1");
		const headerNames = Object.keys(response.headers).map((k) =>
			k.toLowerCase(),
		);
		ok(!headerNames.includes("x-frame-options"));
	});

	test("It should strip handler headers it owns when writing into multiValueHeaders", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			headers: { "X-Frame-Options": "SAMEORIGIN", "X-Keep": "1" },
			multiValueHeaders: {},
		}));
		handler.use(httpSecurityHeaders());

		const response = await handler({ httpMethod: "GET" }, defaultContext);

		deepStrictEqual(response.headers, { "X-Keep": "1" });
		deepStrictEqual(response.multiValueHeaders["X-Frame-Options"], ["DENY"]);
	});

	test("It should set headers when the event is null", async (t) => {
		const handler = middy(() => ({ statusCode: 200, body: "" }));
		handler.use(httpSecurityHeaders());

		const response = await handler(null, defaultContext);

		strictEqual(response.headers["X-Frame-Options"], "DENY");
	});

	const rejectsHeaderOption = (key, value) =>
		throws(
			() => httpSecurityHeadersValidateOptions({ [key]: value }),
			{
				name: "TypeError",
				message: `Option '${key}' must match exactly one schema in oneOf`,
			},
			`${key}: ${JSON.stringify(value)}`,
		);

	const cspDirectives = [
		"child-src",
		"connect-src",
		"default-src",
		"font-src",
		"frame-src",
		"img-src",
		"manifest-src",
		"media-src",
		"object-src",
		"script-src",
		"script-src-elem",
		"script-src-attr",
		"style-src",
		"style-src-elem",
		"style-src-attr",
		"webrtc",
		"worker-src",
		"base-uri",
		"sandbox",
		"form-action",
		"frame-ancestors",
		"report-uri",
		"report-to",
		"block-all-mixed-content",
		"upgrade-insecure-requests",
		"require-trusted-types-for",
		"trusted-types",
		"fenced-frame-src",
	];

	test("httpSecurityHeadersValidateOptions accepts every CSP directive and the documented default", () => {
		httpSecurityHeadersValidateOptions({
			contentSecurityPolicy: Object.fromEntries(
				cspDirectives.map((directive) => [directive, "'self' https://a.com"]),
			),
		});
		httpSecurityHeadersValidateOptions({
			contentSecurityPolicy: {
				"default-src": "'report-sample' 'report-sha256'",
				"base-uri": "'none'",
				sandbox: "",
				"form-action": "'none'",
				"frame-ancestors": "'none'",
				"report-to": "default",
				"require-trusted-types-for": "'script'",
				"upgrade-insecure-requests": "",
			},
		});
		httpSecurityHeadersValidateOptions({
			contentSecurityPolicy: {
				"default-src": "'self'\t'nonce-abc'",
				sandbox: false,
				"upgrade-insecure-requests": false,
			},
		});
		httpSecurityHeadersValidateOptions({ contentSecurityPolicy: true });
	});

	test("httpSecurityHeadersValidateOptions rejects a CSP directive the specs do not define or a value outside directive-value", () => {
		for (const contentSecurityPolicy of [
			{ "defualt-src": "'self'" },
			{ "prefetch-src": "'self'" },
			{ "default-src": "'self'; script-src *" },
			{ "default-src": "'self', 'none'" },
			{ "default-src": "'self'\r\nX-Injected: 1" },
			{ "default-src": true },
			{ "default-src": "a".repeat(1025) },
		]) {
			rejectsHeaderOption("contentSecurityPolicy", contentSecurityPolicy);
		}
	});

	test("httpSecurityHeadersValidateOptions accepts documented Permissions-Policy features and allowlists", () => {
		httpSecurityHeadersValidateOptions({
			permissionsPolicy: {
				accelerometer: "*",
				camera: "",
				"ch-ua-full-version-list": "self",
				"document-domain": "",
				"interest-cohort": "",
				"window-placement": "",
				geolocation: 'self "https://a.example"',
				fullscreen: '"https://*.example.com" src',
			},
		});
		httpSecurityHeadersValidateOptions({
			permissionsPolicy: {
				[`a${"b".repeat(1023)}`]: `"${"c".repeat(1022)}"`,
			},
		});
	});

	test("httpSecurityHeadersValidateOptions rejects a Permissions-Policy feature or allowlist outside the structured field grammar", () => {
		const features = Object.fromEntries(
			Array.from({ length: 1025 }, (_, i) => [`feature-${i}`, ""]),
		);
		for (const permissionsPolicy of [
			{ Camera: "" },
			{ "a b": "" },
			{ [`a${"b".repeat(1024)}`]: "" },
			{ camera: "self), geolocation=*" },
			{ camera: "self\r\nX-Injected: 1" },
			{ camera: '"https://a.example' },
			{ camera: " self" },
			{ camera: `"${"c".repeat(1023)}"` },
			features,
		]) {
			rejectsHeaderOption("permissionsPolicy", permissionsPolicy);
		}
	});

	test("httpSecurityHeadersValidateOptions bounds Reporting-Endpoints names and URLs", () => {
		httpSecurityHeadersValidateOptions({
			reportingEndpoints: {
				csp: "https://example.report-uri.com/a/d/g",
				relative: "/reports",
				"perms_1.a-*": `https://${"a".repeat(1024 - "https://".length)}`,
			},
		});
		const endpoints = Object.fromEntries(
			Array.from({ length: 1025 }, (_, i) => [`e${i}`, "https://a.com"]),
		);
		for (const reportingEndpoints of [
			{ CSP: "https://a.com" },
			{ "a b": "https://a.com" },
			{ csp: "http://a.com" },
			{ csp: "reports" },
			{ csp: 'https://a.com/"' },
			{ csp: "https://a.com/\\" },
			{ csp: `https://${"a".repeat(1024 - "https://".length + 1)}` },
			endpoints,
		]) {
			rejectsHeaderOption("reportingEndpoints", reportingEndpoints);
		}
	});

	test("httpSecurityHeadersValidateOptions accepts Report-To groups and settings", () => {
		httpSecurityHeadersValidateOptions({
			reportTo: {
				default: "https://default.example.com",
				custom: "https://custom.example.com",
				disabled: "",
				maxAge: 31536000,
				includeSubDomains: false,
				includeSubdomains: true,
			},
		});
	});

	test("httpSecurityHeadersValidateOptions rejects a Report-To group or setting outside its type", () => {
		const groups = Object.fromEntries(
			Array.from({ length: 1025 }, (_, i) => [`g${i}`, "https://a.com"]),
		);
		for (const reportTo of [
			{ "a b": "https://a.com" },
			{ default: "http://a.com" },
			{ default: 'https://a.com/"' },
			{ default: true },
			{ maxAge: -1 },
			{ maxAge: 1.5 },
			{ maxAge: "1" },
			{ maxAge: Number.MAX_SAFE_INTEGER + 2 },
			{ includeSubDomains: "yes" },
			{ includeSubdomains: 1 },
			groups,
		]) {
			rejectsHeaderOption("reportTo", reportTo);
		}
	});

	test("httpSecurityHeadersValidateOptions accepts every header value the specs define", () => {
		for (const policy of ["unsafe-none", "require-corp", "credentialless"]) {
			httpSecurityHeadersValidateOptions({
				crossOriginEmbedderPolicy: { policy },
			});
		}
		for (const policy of [
			"unsafe-none",
			"same-origin-allow-popups",
			"same-origin",
			"noopener-allow-popups",
		]) {
			httpSecurityHeadersValidateOptions({
				crossOriginOpenerPolicy: { policy },
			});
		}
		for (const policy of ["same-site", "same-origin", "cross-origin"]) {
			httpSecurityHeadersValidateOptions({
				crossOriginResourcePolicy: { policy },
			});
		}
		for (const action of ["deny", "sameorigin", "DENY", "SAMEORIGIN"]) {
			httpSecurityHeadersValidateOptions({ frameOptions: { action } });
		}
		httpSecurityHeadersValidateOptions({
			contentTypeOptions: { action: "nosniff" },
			downloadOptions: { action: "noopen" },
			originAgentCluster: true,
			xssProtection: {},
		});
	});

	test("httpSecurityHeadersValidateOptions rejects a header value the specs do not define", () => {
		for (const [key, value] of [
			["crossOriginEmbedderPolicy", { policy: "bogus" }],
			["crossOriginOpenerPolicy", { policy: "bogus" }],
			["crossOriginResourcePolicy", { policy: "bogus" }],
			["frameOptions", { action: "allow-from https://a.com" }],
			["contentTypeOptions", { action: "sniff" }],
			["downloadOptions", { action: "open" }],
		]) {
			rejectsHeaderOption(key, value);
		}
	});
});

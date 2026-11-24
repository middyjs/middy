// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	normalizeHttpResponse,
	reservedPropertyNames,
	validateOptions,
} from "@middy/util";

const name = "http-security-headers";
const pkg = `@middy/${name}`;

const booleanOr = (objectSchema) => ({
	oneOf: [{ type: "boolean" }, objectSchema],
});

const closedObject = (properties) => ({
	type: "object",
	properties,
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
});

const enumObject = (key, values) =>
	closedObject({ [key]: { type: "string", enum: values } });

const headerMap = (propertyNames, value, properties = {}) => ({
	type: "object",
	properties,
	propertyNames: {
		type: "string",
		maxLength: 1024,
		pattern: propertyNames,
		not: { type: "string", enum: reservedPropertyNames },
	},
	maxProperties: 1024,
	required: [],
	additionalProperties: { type: "string", maxLength: 1024, pattern: value },
	unevaluatedProperties: false,
});

// CSP Level 3 section 2.3: "directive-value = *( required-ascii-whitespace /
// ( %x21-%x2B / %x2D-%x3A / %x3C-%x7E ) )", without the CR, LF and FF that
// RFC 9110 section 5.5 rules out of a field value
// https://www.w3.org/TR/CSP3/#framework-directives
// https://www.rfc-editor.org/rfc/rfc9110#section-5.5
const cspDirectiveValue = {
	oneOf: [
		{
			type: "string",
			maxLength: 1024,
			pattern: /^[\t \x21-\x2B\x2D-\x3A\x3C-\x7E]*$/u,
		},
		{ type: "boolean", const: false },
	],
};

// CSP Level 3 section 6 (6.6 adds block-all-mixed-content and
// upgrade-insecure-requests), Trusted Types section 4.2, Fenced Frame 4.2.2
// https://www.w3.org/TR/CSP3/#csp-directives
// https://www.w3.org/TR/trusted-types/#integration-with-content-security-policy
// https://wicg.github.io/fenced-frame/#new-csp-directive
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

// RFC 9651 section 3.1.2: "key = ( lcalpha / "*" ) *( lcalpha / DIGIT / "_" /
// "-" / "." / "*" )"
// https://www.rfc-editor.org/rfc/rfc9651#section-3.1.2
const structuredFieldKey = /^[a-z*][a-z0-9_.*-]*$/u;

// Permissions Policy section 6.1: an allowlist is a String, a Token or an
// Inner List of them (RFC 9651 sections 3.1.1, 3.3.3 and 3.3.4)
// https://www.w3.org/TR/permissions-policy/#permissions-policy-http-header-field
// https://www.rfc-editor.org/rfc/rfc9651#section-3.1.1
const allowlistMember =
	'(?:[A-Za-z*][\\w!#$%&\'*+.^`|~:/-]{0,1023}|"[ !\\x23-\\x5B\\x5D-\\x7E]{0,1022}")';

// Reporting API section 3.3: an endpoint is a URI-reference resolved against
// the response URL and skipped unless potentially trustworthy
// https://www.w3.org/TR/reporting-1/#process-header
const endpointUrl =
	"(?:https://[\\x21\\x23-\\x5B\\x5D-\\x7E]+|/[\\x21\\x23-\\x5B\\x5D-\\x7E]*)";

const referrerPolicyValues = [
	"no-referrer",
	"no-referrer-when-downgrade",
	"origin",
	"origin-when-cross-origin",
	"same-origin",
	"strict-origin",
	"strict-origin-when-cross-origin",
	"unsafe-url",
];

const permittedCrossDomainPoliciesValues = [
	"none",
	"master-only",
	"by-content-type",
	"by-ftp-filename",
	"all",
];

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:http-security-headers:options",
	type: "object",
	properties: {
		contentSecurityPolicy: booleanOr(
			closedObject(
				Object.fromEntries(
					cspDirectives.map((directive) => [directive, cspDirectiveValue]),
				),
			),
		),
		contentSecurityPolicyReportOnly: { type: "boolean" },
		// Fetch: "X-Content-Type-Options: nosniff"
		// https://fetch.spec.whatwg.org/#x-content-type-options-header
		contentTypeOptions: booleanOr(enumObject("action", ["nosniff"])),
		// HTML: embedder policy values
		// https://html.spec.whatwg.org/multipage/browsers.html#embedder-policy-value
		crossOriginEmbedderPolicy: booleanOr(
			enumObject("policy", ["unsafe-none", "require-corp", "credentialless"]),
		),
		// HTML: opener policy values
		// https://html.spec.whatwg.org/multipage/browsers.html#cross-origin-opener-policy-value
		crossOriginOpenerPolicy: booleanOr(
			enumObject("policy", [
				"unsafe-none",
				"same-origin-allow-popups",
				"same-origin",
				"noopener-allow-popups",
			]),
		),
		// Fetch: "Cross-Origin-Resource-Policy = %s"same-origin" / %s"same-site" /
		// %s"cross-origin""
		// https://fetch.spec.whatwg.org/#cross-origin-resource-policy-header
		crossOriginResourcePolicy: booleanOr(
			enumObject("policy", ["same-site", "same-origin", "cross-origin"]),
		),
		dnsPrefetchControl: booleanOr(closedObject({ allow: { type: "boolean" } })),
		downloadOptions: booleanOr(enumObject("action", ["noopen"])),
		// HTML: X-Frame-Options values are ASCII case-insensitive "DENY" and
		// "SAMEORIGIN"
		// https://html.spec.whatwg.org/multipage/document-lifecycle.html#the-x-frame-options-header
		frameOptions: booleanOr(
			enumObject("action", ["deny", "sameorigin", "DENY", "SAMEORIGIN"]),
		),
		originAgentCluster: booleanOr(closedObject({})),
		permissionsPolicy: booleanOr(
			headerMap(
				structuredFieldKey,
				new RegExp(
					`^(?:${allowlistMember}(?: {1,1024}${allowlistMember}){0,1023})?$`,
					"u",
				),
			),
		),
		permittedCrossDomainPolicies: booleanOr(
			enumObject("policy", permittedCrossDomainPoliciesValues),
		),
		poweredBy: { type: "boolean" },
		referrerPolicy: booleanOr(enumObject("policy", referrerPolicyValues)),
		reportingEndpoints: booleanOr(
			headerMap(structuredFieldKey, new RegExp(`^${endpointUrl}$`, "u")),
		),
		reportTo: booleanOr(
			headerMap(/^[\w.-]+$/u, new RegExp(`^(?:${endpointUrl})?$`, "u"), {
				maxAge: {
					type: "integer",
					minimum: 0,
					maximum: Number.MAX_SAFE_INTEGER,
				},
				includeSubDomains: { type: "boolean" },
				includeSubdomains: { type: "boolean" },
			}),
		),
		strictTransportSecurity: booleanOr(
			closedObject({
				maxAge: {
					type: "number",
					minimum: 0,
					maximum: Number.MAX_SAFE_INTEGER,
				},
				includeSubDomains: { type: "boolean" },
				preload: { type: "boolean" },
			}),
		),
		xssProtection: booleanOr(closedObject({})),
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const httpSecurityHeadersValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// Code and Defaults heavily based off https://helmetjs.github.io/

const defaults = {
	contentSecurityPolicy: {
		// Fetch directives
		// 'child-src': '', // fallback default-src
		// 'connect-src': '', // fallback default-src
		"default-src": "'report-sample' 'report-sha256'",
		// 'font-src':'', // fallback default-src
		// 'frame-src':'', // fallback child-src > default-src
		// 'img-src':'', // fallback default-src
		// 'manifest-src':'', // fallback default-src
		// 'media-src':'', // fallback default-src
		// 'object-src':'', // fallback default-src
		// 'prefetch-src':'', // fallback default-src
		// 'script-src':'', // fallback default-src
		// 'script-src-elem':'', // fallback script-src > default-src
		// 'script-src-attr':'', // fallback script-src > default-src
		// 'style-src':'', // fallback default-src
		// 'style-src-elem':'', // fallback style-src > default-src
		// 'style-src-attr':'', // fallback style-src > default-src
		// 'worker-src':'', // fallback child-src > script-src > default-src
		// Document directives
		"base-uri": "'none'",
		sandbox: "",
		// Navigation directives
		"form-action": "'none'",
		"frame-ancestors": "'none'",
		// Reporting directives
		"report-to": "default",
		// Other directives
		"require-trusted-types-for": "'script'",
		"upgrade-insecure-requests": "",
	},
	contentSecurityPolicyReportOnly: false,
	contentTypeOptions: {
		action: "nosniff",
	},
	crossOriginEmbedderPolicy: {
		policy: "require-corp",
	},
	crossOriginOpenerPolicy: {
		policy: "same-origin",
	},
	crossOriginResourcePolicy: {
		policy: "same-origin",
	},
	// `allow` is off unless set to true.
	dnsPrefetchControl: {},
	downloadOptions: {
		action: "noopen",
	},
	frameOptions: {
		action: "deny",
	},
	originAgentCluster: {},
	// Every policy-controlled feature in the W3C registry, in its order, each
	// denied to all origins. The registry's retired features are left out.
	// https://github.com/w3c/webappsec-permissions-policy/blob/main/features.md
	permissionsPolicy: {
		// Standardized
		accelerometer: "",
		"ambient-light-sensor": "",
		"attribution-reporting": "",
		autoplay: "",
		battery: "",
		bluetooth: "",
		camera: "",
		"ch-ua": "",
		"ch-ua-arch": "",
		"ch-ua-bitness": "",
		"ch-ua-full-version": "",
		"ch-ua-full-version-list": "",
		"ch-ua-high-entropy-values": "",
		"ch-ua-mobile": "",
		"ch-ua-model": "",
		"ch-ua-platform": "",
		"ch-ua-platform-version": "",
		"ch-ua-wow64": "",
		"compute-pressure": "",
		"cross-origin-isolated": "",
		"direct-sockets": "",
		"display-capture": "",
		"encrypted-media": "",
		"execution-while-not-rendered": "",
		"execution-while-out-of-viewport": "",
		fullscreen: "",
		geolocation: "",
		gyroscope: "",
		hid: "",
		"identity-credentials-get": "",
		"idle-detection": "",
		"keyboard-map": "",
		magnetometer: "",
		mediasession: "",
		microphone: "",
		midi: "",
		"navigation-override": "",
		"otp-credentials": "",
		payment: "",
		"picture-in-picture": "",
		"publickey-credentials-get": "",
		"publickey-credentials-remote-client-data-json": "",
		"screen-wake-lock": "",
		serial: "",
		"sync-xhr": "",
		"storage-access": "",
		tools: "",
		usb: "",
		"web-share": "",
		"window-management": "",
		"xr-spatial-tracking": "",
		// Proposed
		autofill: "",
		"clipboard-read": "",
		"clipboard-write": "",
		"deferred-fetch": "",
		gamepad: "",
		"language-detector": "",
		"language-model": "",
		"manual-text": "",
		rewriter: "",
		"speaker-selection": "",
		summarizer: "",
		translator: "",
		haptics: "",
		writer: "",
		// Experimental
		"all-screens-capture": "",
		"browsing-topics": "",
		"captured-surface-control": "",
		"conversion-measurement": "",
		"digital-credentials-create": "",
		"digital-credentials-get": "",
		"focus-without-user-activation": "",
		"join-ad-interest-group": "",
		"local-fonts": "",
		monetization: "",
		"run-ad-auction": "",
		"smart-card": "",
		"sync-script": "",
		"trust-token-redemption": "",
		unload: "",
		"vertical-scroll": "",
	},
	permittedCrossDomainPolicies: {
		policy: "none", // none, master-only, by-content-type, by-ftp-filename, all
	},
	poweredBy: true,
	referrerPolicy: {
		policy: "no-referrer",
	},
	reportingEndpoints: {},
	reportTo: {
		maxAge: 365 * 24 * 60 * 60,
		includeSubDomains: true,
	},
	strictTransportSecurity: {
		maxAge: 180 * 24 * 60 * 60,
		includeSubDomains: true,
		// hstspreload.org: "If you maintain a project that provides HTTPS
		// configuration advice or provides an option to enable HSTS, do not
		// include the preload directive by default."
		// https://hstspreload.org/#opt-in
		preload: false,
	},
	xssProtection: false,
};

const helmet = {};

// *** https://github.com/helmetjs/helmet/tree/main/middlewares *** //
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
helmet.contentSecurityPolicy = (reportOnly) => (headers, config) => {
	let header = Object.keys(config)
		.map((policy) => (config[policy] ? `${policy} ${config[policy]}` : ""))
		.filter((str) => str)
		.join("; ");
	if (config.sandbox === "") {
		header += "; sandbox";
	}
	if (config["upgrade-insecure-requests"] === "") {
		header += "; upgrade-insecure-requests";
	}

	const cspHeaderName = reportOnly
		? "Content-Security-Policy-Report-Only"
		: "Content-Security-Policy";
	headers[cspHeaderName] = header;
};
// crossdomain - N/A - for Adobe products
helmet.crossOriginEmbedderPolicy = (headers, config) => {
	headers["Cross-Origin-Embedder-Policy"] = config.policy;
};
helmet.crossOriginOpenerPolicy = (headers, config) => {
	headers["Cross-Origin-Opener-Policy"] = config.policy;
};
helmet.crossOriginResourcePolicy = (headers, config) => {
	headers["Cross-Origin-Resource-Policy"] = config.policy;
};

// DEPRECATED: expectCt
// DEPRECATED: hpkp

// https://www.permissionspolicy.com/
helmet.permissionsPolicy = (headers, config) => {
	headers["Permissions-Policy"] = Object.keys(config)
		.map(
			(policy) =>
				`${policy}=${config[policy] === "*" ? "*" : `(${config[policy]})`}`,
		)
		.join(", ");
};

helmet.originAgentCluster = (headers) => {
	headers["Origin-Agent-Cluster"] = "?1";
};

// https://github.com/helmetjs/referrer-policy
helmet.referrerPolicy = (headers, config) => {
	headers["Referrer-Policy"] = config.policy;
};

// DEPRECATED by reportingEndpoints
helmet.reportTo = (headers, config) => {
	// `maxAge` and `includeSubDomains` are settings, not endpoint groups. Accept
	// both `includeSubDomains` (aligned with HSTS) and the legacy `includeSubdomains`
	// casing so a user override is honored either way.
	const settingKeys = new Set([
		"maxAge",
		"includeSubDomains",
		"includeSubdomains",
	]);
	// Defaults only set `includeSubDomains`; a legacy `includeSubdomains` key can
	// only come from a user override, so honor it when present.
	const includeSubDomains = Object.hasOwn(config, "includeSubdomains")
		? config.includeSubdomains
		: config.includeSubDomains;
	const header = Object.keys(config)
		.map((group) => {
			if (settingKeys.has(group)) return "";
			const subdomains =
				group === "default"
					? `, "include_subdomains": ${includeSubDomains}`
					: "";
			return config[group]
				? `{ "group": "${group}", "max_age": ${config.maxAge}, "endpoints": [ { "url": "${config[group]}" } ]${subdomains} }`
				: "";
		})
		.filter((str) => str)
		.join(", ");
	// Don't emit an empty header when no endpoints are configured.
	if (header) {
		headers["Report-To"] = header;
	}
};

helmet.reportingEndpoints = (headers, config) => {
	const header = Object.keys(config)
		.map((key) => `${key}="${config[key]}"`)
		.join(", ");
	// Don't emit an empty header when no endpoints are configured.
	if (header) {
		headers["Reporting-Endpoints"] = header;
	}
};

// https://github.com/helmetjs/hsts
helmet.strictTransportSecurity = (headers, config) => {
	const maxAge = Math.round(config.maxAge);
	let header = `max-age=${maxAge}`;
	if (config.includeSubDomains) {
		header += "; includeSubDomains";
	}
	// The HSTS preload list only accepts entries with max-age >= 31536000 (1 year).
	// Emitting `preload` below that threshold produces an invalid token, so omit it.
	if (config.preload && maxAge >= 31536000) {
		header += "; preload";
	}
	headers["Strict-Transport-Security"] = header;
};

// noCache - N/A - separate middleware

// X-* //
// https://github.com/helmetjs/dont-sniff-mimetype
helmet.contentTypeOptions = (headers, config) => {
	headers["X-Content-Type-Options"] = config.action;
};

// https://github.com/helmetjs/dns-Prefetch-control
helmet.dnsPrefetchControl = (headers, config) => {
	headers["X-DNS-Prefetch-Control"] = config.allow ? "on" : "off";
};

// https://github.com/helmetjs/ienoopen
helmet.downloadOptions = (headers, config) => {
	headers["X-Download-Options"] = config.action;
};

// https://github.com/helmetjs/frameOptions
helmet.frameOptions = (headers, config) => {
	headers["X-Frame-Options"] = config.action.toUpperCase();
};

// https://github.com/helmetjs/crossdomain
helmet.permittedCrossDomainPolicies = (headers, config) => {
	headers["X-Permitted-Cross-Domain-Policies"] = config.policy;
};

// https://github.com/helmetjs/hide-powered-by
// Removal handled in the after hook, together with the headers this sets
helmet.poweredBy = () => {};

// https://github.com/helmetjs/x-xss-protection
helmet.xssProtection = (headers, config) => {
	headers["X-XSS-Protection"] = "0";
};

const httpSecurityHeadersMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	// Pre-compute all static header values once at initialization
	const precomputedHeaders = {};
	for (const key of Object.keys(helmet)) {
		if (!options[key]) continue;
		const config = { ...defaults[key], ...options[key] };
		if (key === "contentSecurityPolicy") {
			helmet[key](options.contentSecurityPolicyReportOnly)(
				precomputedHeaders,
				config,
			);
		} else {
			helmet[key](precomputedHeaders, config);
		}
	}

	// Header names are case-insensitive (RFC 9110 §5.1). A handler header that
	// this middleware sets, or removes under `poweredBy`, is dropped in every
	// casing, so the middleware's value still wins and only one copy is sent.
	const replacedNames = new Set(
		Object.keys(precomputedHeaders).map((key) => key.toLowerCase()),
	);
	if (options.poweredBy) {
		replacedNames.add("server");
		replacedNames.add("x-powered-by");
	}

	const httpSecurityHeadersMiddlewareAfter = (request) => {
		const response = normalizeHttpResponse(request);
		response.headers = withoutHeaderNames(response.headers, replacedNames);
		if (
			typeof response.multiValueHeaders === "undefined" &&
			!isAlbMultiValue(request.event)
		) {
			Object.assign(response.headers, precomputedHeaders);
			return;
		}
		// API Gateway REST lets `multiValueHeaders` win over `headers` for the
		// same name, and ALB with multi-value headers enabled reads only
		// `multiValueHeaders`, so the headers go there.
		const multiValueHeaders = withoutHeaderNames(
			response.multiValueHeaders ?? {},
			replacedNames,
		);
		for (const key of Object.keys(precomputedHeaders)) {
			multiValueHeaders[key] = [precomputedHeaders[key]];
		}
		response.multiValueHeaders = multiValueHeaders;
	};
	const httpSecurityHeadersMiddlewareOnError = (request) => {
		if (typeof request.response === "undefined") return;
		httpSecurityHeadersMiddlewareAfter(request);
	};
	return {
		after: httpSecurityHeadersMiddlewareAfter,
		onError: httpSecurityHeadersMiddlewareOnError,
	};
};

// Copies a header map without the names (lower-cased) in `names`, in any
// casing.
const withoutHeaderNames = (map, names) => {
	const kept = {};
	for (const key of Object.keys(map)) {
		if (!names.has(key.toLowerCase())) {
			kept[key] = map[key];
		}
	}
	return kept;
};

// An ALB target group with multi-value headers enabled sends
// `multiValueHeaders` and only reads them back: "You must use
// multiValueHeaders if you have enabled multi-value headers and headers
// otherwise." Its events are the only ones that carry `requestContext.elb`
// together with `multiValueHeaders`.
// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
const isAlbMultiValue = (event) =>
	typeof event?.requestContext?.elb !== "undefined" &&
	typeof event.multiValueHeaders !== "undefined";

export default httpSecurityHeadersMiddleware;

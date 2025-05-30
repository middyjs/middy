import type middy from "@middy/core";

interface Options {
	dnsPrefetchControl?: {
		allow?: boolean;
	};
	frameOptions?: {
		action?: string;
	};
	poweredBy?: {
		server: string;
	};
	strictTransportSecurity?: {
		maxAge?: number;
		includeSubDomains?: boolean;
		preload?: boolean;
	};
	downloadOptions?: {
		action?: string;
	};
	contentTypeOptions?: {
		action?: string;
	};
	originAgentCluster?: boolean;
	referrerPolicy?: {
		policy?: string;
	};
	xssProtection?: {
		reportUri?: string;
	};
	contentSecurityPolicy?: Record<string, string>;
	contentSecurityPolicyReportOnly?: boolean;
	crossOriginEmbedderPolicy?: {
		policy?: string;
	};
	crossOriginOpenerPolicy?: {
		policy?: string;
	};
	crossOriginResourcePolicy?: {
		policy?: string;
	};
	permissionsPolicy?: Record<string, string>;
	permittedCrossDomainPolicies?: {
		policy?: string;
	};
	reportTo?: {
		maxAge?: number;
		default?: string;
		includeSubdomains?: boolean;
		csp?: string;
		staple?: string;
		xss?: string;
	};
}

type WithBoolValues<T> = { [K in keyof T]: T[K] | boolean };

declare function httpSecurityHeaders(
	options?: WithBoolValues<Options>,
): middy.MiddlewareObj;

export default httpSecurityHeaders;

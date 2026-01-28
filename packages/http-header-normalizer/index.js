const exceptionsList = [
	"ALPN",
	"C-PEP",
	"C-PEP-Info",
	"CalDAV-Timezones",
	"Content-ID",
	"Content-MD5",
	"DASL",
	"DAV",
	"DNT",
	"ETag",
	"GetProfile",
	"HTTP2-Settings",
	"Last-Event-ID",
	"MIME-Version",
	"NEL",
	"Optional-WWW-Authenticate",
	"Sec-WebSocket-Accept",
	"Sec-WebSocket-Extensions",
	"Sec-WebSocket-Key",
	"Sec-WebSocket-Protocol",
	"Sec-WebSocket-Version",
	"SLUG",
	"TCN",
	"TE",
	"TTL",
	"WWW-Authenticate",
	"X-ATT-DeviceId",
	"X-DNSPrefetch-Control",
	"X-UIDH",
];

const exceptions = exceptionsList.reduce((acc, curr) => {
	acc[curr.toLowerCase()] = curr;
	return acc;
}, {});

const normalizeHeaderKey = (key, canonical) => {
	const lowerCaseKey = key.toLowerCase();
	if (!canonical) {
		return lowerCaseKey;
	}

	if (exceptions[lowerCaseKey]) {
		return exceptions[lowerCaseKey];
	}

	return lowerCaseKey
		.split("-")
		.map((text) => (text[0] || "").toUpperCase() + text.substr(1))
		.join("-");
};

const defaults = {
	canonical: false,
	defaultHeaders: {},
	normalizeHeaderKey,
};

const httpHeaderNormalizerMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const defaultHeaders = {};
	const defaultMultiValueHeaders = {};
	for (const key of Object.keys(options.defaultHeaders)) {
		const newKey = options.normalizeHeaderKey(key, options.canonical);
		const isArray = Array.isArray(options.defaultHeaders[key]);
		defaultHeaders[newKey] = isArray
			? options.defaultHeaders[key].join(",")
			: options.defaultHeaders[key];
		defaultMultiValueHeaders[newKey] = isArray
			? options.defaultHeaders[key]
			: options.defaultHeaders[key].split(",");
	}

	const httpHeaderNormalizerMiddlewareBefore = async (request) => {
		if (request.event.headers) {
			const headers = { ...defaultHeaders };

			for (const key of Object.keys(request.event.headers)) {
				headers[options.normalizeHeaderKey(key, options.canonical)] =
					request.event.headers[key];
			}

			request.event.headers = headers;
		}

		if (request.event.multiValueHeaders) {
			const headers = { ...defaultMultiValueHeaders };

			for (const key of Object.keys(request.event.multiValueHeaders)) {
				headers[options.normalizeHeaderKey(key, options.canonical)] =
					request.event.multiValueHeaders[key];
			}

			request.event.multiValueHeaders = headers;
		}
	};

	return {
		before: httpHeaderNormalizerMiddlewareBefore,
	};
};

export default httpHeaderNormalizerMiddleware;

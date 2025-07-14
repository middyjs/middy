import { jsonSafeParse, normalizeHttpResponse } from "@middy/util";

const defaults = {
	logger: console.error, // TODO v7 change to pass in request
	fallbackMessage: undefined,
};

const httpErrorHandlerMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const httpErrorHandlerMiddlewareOnError = async (request) => {
		if (request.response !== undefined) return;
		if (typeof options.logger === "function") {
			options.logger(request.error);
		}

		// Set default expose value, only passes in when there is an override
		if (request.error.statusCode && request.error.expose === undefined) {
			request.error.expose = request.error.statusCode < 500;
		}

		// Non-http error OR expose set to false
		if (!request.error.expose || !request.error.statusCode) {
			request.error = {
				statusCode: 500,
				message: options.fallbackMessage,
				expose: true,
			};
		}

		if (request.error.expose) {
			normalizeHttpResponse(request);
			const { statusCode, message, headers } = request.error;

			request.response = {
				...request.response,
				statusCode,
				headers: {
					...request.response.headers,
					...headers,
				},
			};

			if (message) {
				const headerContentType =
					typeof jsonSafeParse(message) === "string"
						? "text/plain"
						: "application/json";
				request.response.body = message;
				request.response.headers["Content-Type"] = headerContentType;
			}
		}
	};

	return {
		onError: httpErrorHandlerMiddlewareOnError,
	};
};
export default httpErrorHandlerMiddleware;

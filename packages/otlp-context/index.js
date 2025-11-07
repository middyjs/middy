import { context } from "@opentelemetry/api";

// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
const awsContextKeys = [
	"functionName",
	"functionVersion",
	"invokedFunctionArn",
	"memoryLimitInMB",
	"awsRequestId",
	"logGroupName",
	"logStreamName",
	"identity",
	"clientContext",
	"callbackWaitsForEmptyEventLoop",
];

const openTelemetryProtocolContextMiddleware = () => {
	const openTelemetryProtocolContextMiddlewareBefore = async (request) => {
		const attributes = [];
		for (const key of awsContextKeys) {
			if (request.context[key]) {
				const value = request.context[key];
				//ctx._currentContext.set(key, value)
				attributes.push({ key, value });
			}
		}
		// ctx.setValue(key, value) doesn't work ... :(
		context.active()._currentContext.set("attributes", attributes);
	};

	return {
		before: openTelemetryProtocolContextMiddlewareBefore,
	};
};

export default openTelemetryProtocolContextMiddleware;

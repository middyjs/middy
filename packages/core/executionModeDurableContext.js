import { withDurableExecution } from "@aws/durable-execution-sdk-js";
import { executionContextKeys, lambdaContextKeys } from "@middy/util";

export const executionModeDurableContext = (
	{ middyRequest, runRequest },
	beforeMiddlewares,
	lambdaHandler,
	afterMiddlewares,
	onErrorMiddlewares,
	plugin,
) => {
	const middy = withDurableExecution(async (event, context) => {
		const request = middyRequest(event, context);
		plugin.requestStart?.(request);

		// normalize context with executionModeStandard
		// https://docs.aws.amazon.com/lambda/latest/dg/typescript-context.html
		copyKeys(
			request.context,
			request.context.executionContext,
			executionContextKeys,
		);
		copyKeys(request.context, request.context.lambdaContext, lambdaContextKeys);

		const response = await runRequest(
			request,
			beforeMiddlewares,
			lambdaHandler,
			afterMiddlewares,
			onErrorMiddlewares,
			plugin,
		);
		await plugin.requestEnd?.(request);
		return response;
	});
	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};
	return middy;
};

const copyKeys = (to, from, keys) => {
	keys.forEach((key) => {
		to[key] = from[key];
	});
};

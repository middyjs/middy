import type middy from "@middy/core";

interface Options {
	logger?: ((error: any) => undefined) | boolean;
	fallbackMessage?: string;
}

declare function httpErrorHandler(options?: Options): middy.MiddlewareObj;

export default httpErrorHandler;

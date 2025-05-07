import type middy from "@middy/core";

interface Options {
	logger?: ((error: any) => void) | boolean;
	fallbackMessage?: string;
}

declare function httpErrorHandler(options?: Options): middy.MiddlewareObj;

export default httpErrorHandler;

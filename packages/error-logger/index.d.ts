import type middy from "@middy/core";

interface Options {
	logger?: (request: any) => void;
}

declare function errorLogger(options?: Options): middy.MiddlewareObj;

export default errorLogger;

import type middy from "@middy/core";

interface Options {
	logger?: (message: any) => void;
	executionContext?: boolean;
	lambdaContext?: boolean;
	omitPaths?: string[];
	mask?: string;
}

declare function inputOutputLogger(options?: Options): middy.MiddlewareObj;

export default inputOutputLogger;

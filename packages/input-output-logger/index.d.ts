import type middy from "@middy/core";

interface Options {
	logger?: (message: any) => undefined;
	awsContext?: boolean;
	omitPaths?: string[];
	mask?: string;
}

declare function inputOutputLogger(options?: Options): middy.MiddlewareObj;

export default inputOutputLogger;

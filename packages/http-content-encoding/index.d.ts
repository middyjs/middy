import type middy from "@middy/core";

interface Options {
	br?: any;
	gzip?: any;
	deflate?: any;
	zstd?: any;
	overridePreferredEncoding?: string[];
}

declare function httpContentEncoding(options?: Options): middy.MiddlewareObj;

export default httpContentEncoding;

import type middy from "@middy/core";

interface Options {
	isWarmingUp?: (event: any) => boolean;
	onWarmup?: (event: any) => undefined;
}

declare function warmup(options?: Options): middy.MiddlewareObj;

export default warmup;

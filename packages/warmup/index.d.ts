import type middy from "@middy/core";

interface Options {
	isWarmingUp?: (event: any) => boolean;
	onWarmup?: (event: any) => void;
}

declare function warmup(options?: Options): middy.MiddlewareObj;

export default warmup;

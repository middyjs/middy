import type middy from "@middy/core";

interface Options {
	logger?: (reason: any, record: any) => void;
}

declare function sqsPartialBatchFailure(options?: Options): middy.MiddlewareObj;

export default sqsPartialBatchFailure;

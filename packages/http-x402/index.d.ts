import type middy from "@middy/core";

export interface Options {
	FacilitatorClient?: new (config: {
		url?: string;
	}) => {
		verify(payload: unknown, requirements: unknown): Promise<unknown>;
		settle(payload: unknown, requirements: unknown): Promise<unknown>;
	};
	facilitatorUrl?: string;
	price: number;
	decimals?: number;
	network?: string;
	payTo: string;
	asset: string;
	description?: string;
	mimeType?: string;
	human?: (request: middy.Request) => boolean;
}

declare function httpX402(options: Options): middy.MiddlewareObj;

export declare function httpX402ValidateOptions(
	options?: Record<string, unknown>,
): void;

export default httpX402;

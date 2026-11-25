// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

export declare function retryDelay(
	retryDelayMs: number,
	attempt: number,
): number;

export declare function sleep(ms: number, signal?: AbortSignal): Promise<void>;

export declare function isTransientReadError(
	err: {
		name?: string;
		code?: string;
		$metadata?: { httpStatusCode?: number };
	},
	transientErrorNames: ReadonlySet<string>,
): boolean;

export interface MqBatcherOptions {
	batchSize?: number;
	batchWindowMs?: number;
	maxRetryAttempts?: number;
	retryDelayMs?: number;
}

export interface MqBatcher<TDelivery, TEvent extends object> {
	batchSize: number;
	wakeReader: () => void;
	deliver: (delivery: TDelivery) => void;
	failPoll: (err: unknown) => void;
	batches: (
		signal: AbortSignal,
		handlers: {
			toEvent: (batch: TDelivery[]) => TEvent;
			discard: (batch: TDelivery[], event: TEvent) => void;
		},
	) => AsyncGenerator<TEvent, void, undefined>;
	acknowledge: (event: TEvent) => TDelivery[];
}

export declare function mqBatcher<
	TDelivery = unknown,
	TEvent extends object = object,
>(opts: MqBatcherOptions): MqBatcher<TDelivery, TEvent>;

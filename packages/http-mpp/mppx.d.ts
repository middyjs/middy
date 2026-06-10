// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

interface MppxConfig {
	methods: unknown[];
	realm?: string;
	secretKey?: string;
	transport?: unknown;
}

export declare function httpMppVerify(
	mppxConfig: MppxConfig,
): (token: string) => Promise<boolean>;

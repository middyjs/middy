// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

export interface SslOptions {
	/**
	 * Hostname the server certificate is verified against (also sent as SNI).
	 * Set this to the real RDS endpoint when connecting through a CNAME.
	 */
	servername?: string;
}

export interface SslConfig {
	ssl: {
		rejectUnauthorized: true;
		ca: string;
		servername?: string;
	};
}

declare const ssl: (ca: string, options?: SslOptions) => SslConfig;
export default ssl;

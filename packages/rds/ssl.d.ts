// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { PeerCertificate } from "node:tls";

declare const ssl: (ca: string) => {
	ssl: {
		rejectUnauthorized: boolean;
		ca: string;
		checkServerIdentity: (
			host: string,
			cert: PeerCertificate,
		) => Error | undefined;
	};
};
export default ssl;

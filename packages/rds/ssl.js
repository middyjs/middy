// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { checkServerIdentity } from "node:tls";

export default (ca) => ({
	sslmode: "require",
	ssl: {
		rejectUnauthorized: true,
		ca,
		checkServerIdentity: (host, cert) => {
			const error = checkServerIdentity(host, cert);
			if (error && !cert.subject?.CN?.endsWith(".rds.amazonaws.com")) {
				return error;
			}
		},
	},
});

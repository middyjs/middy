// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { checkServerIdentity } from "node:tls";

export default (ca) => {
	const region = process.env.AWS_REGION;
	const suffix = region ? `.${region}.rds.amazonaws.com` : ".rds.amazonaws.com";
	return {
		ssl: {
			rejectUnauthorized: true,
			ca,
			checkServerIdentity: (host, cert) => {
				const error = checkServerIdentity(host, cert);
				if (error && !cert.subject?.CN?.endsWith(suffix)) {
					return error;
				}
			},
		},
	};
};

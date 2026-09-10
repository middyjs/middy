// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import tls from "node:tls";

export default (ca, { servername } = {}) => {
	const ssl = {
		rejectUnauthorized: true,
		ca,
	};
	if (servername) {
		ssl.servername = servername;
		ssl.checkServerIdentity = (_host, cert) =>
			tls.checkServerIdentity(servername, cert);
	}
	return { ssl };
};

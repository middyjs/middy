// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

export default (ca, { servername } = {}) => {
	const ssl = {
		rejectUnauthorized: true,
		ca,
	};
	if (servername) {
		ssl.servername = servername;
	}
	return { ssl };
};

// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { readFileSync } from "node:fs";

export default () => {
	if (!process.env.NODE_EXTRA_CA_CERTS) {
		throw new Error("NODE_EXTRA_CA_CERTS environment variable is not set", {
			cause: { package: "@middy/rds", data: { env: "NODE_EXTRA_CA_CERTS" } },
		});
	}
	return readFileSync(process.env.NODE_EXTRA_CA_CERTS, {
		encoding: "utf8",
	});
};

// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { AuroraDSQLClient } from "@aws/aurora-dsql-node-postgres-connector";

export default async (config) => {
	const client = new AuroraDSQLClient(config);
	await client.connect();
	return client;
};

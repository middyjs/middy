// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import pg from "pg";

export default async (config) => {
	const client = new pg.Client(config);
	await client.connect();
	return client;
};

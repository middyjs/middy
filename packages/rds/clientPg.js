// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import pg from "pg";

const pkg = "@middy/rds";

// The middleware config (and the signer's fetchData) use `username`; pg only
// reads `user`, so map it across and drop the key pg would ignore.
const pgConfig = (config) => {
	if (config.username === undefined) return config;
	const { username, ...rest } = config;
	return { user: username, ...rest };
};

export default async (config) => {
	const client = new pg.Client(pgConfig(config));
	// A cached pg.Client emits `error` when the server drops the connection
	// (idle timeout, failover, a thaw after a long Lambda freeze); with no
	// listener that is an uncaught exception. Log it and flag the client so
	// the middleware reconnects instead of handing out a dead connection.
	client.on("error", (e) => {
		console.error("%s: client error: %s", pkg, e.message);
		client.broken = true;
	});
	await client.connect();
	return client;
};

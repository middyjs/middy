// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import pg from "pg";

const pkg = "@middy/dsql";

// The middleware config (and the signer's fetchData) use `username`; pg only
// reads `user`, so map it across and drop the key pg would ignore.
const pgConfig = (config) => {
	if (config.username === undefined) return config;
	const { username, ...rest } = config;
	return { user: username, ...rest };
};

export default (config) => {
	const pool = new pg.Pool(pgConfig(config));
	// pg.Pool emits `error` when the server drops an idle client; with no
	// listener that is an uncaught exception. The pool discards the client
	// and stays usable, so only log it.
	pool.on("error", (e) => {
		console.error("%s: pool error: %s", pkg, e.message);
	});
	return pool;
};

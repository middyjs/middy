// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import pg from "pg";

export default (config) => new pg.Pool(config);

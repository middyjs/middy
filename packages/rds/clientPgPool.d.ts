// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Pool } from "pg";
import type { RdsClient } from "./index.js";

declare const clientPgPool: RdsClient<Pool>;
export default clientPgPool;

// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type postgres from "postgres";
import type { RdsClient } from "./index.js";

declare const clientPostgres: RdsClient<ReturnType<typeof postgres>>;
export default clientPostgres;

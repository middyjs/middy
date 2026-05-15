// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type postgres from "postgres";
import type { DsqlClient } from "./index.js";

declare const clientPostgres: DsqlClient<ReturnType<typeof postgres>>;
export default clientPostgres;

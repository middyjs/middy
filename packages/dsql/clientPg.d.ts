// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { AuroraDSQLClient } from "@aws/aurora-dsql-node-postgres-connector";
import type { DsqlClient } from "./index.js";

declare const clientPg: DsqlClient<AuroraDSQLClient>;
export default clientPg;

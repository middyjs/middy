// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { AuroraDSQLPool } from "@aws/aurora-dsql-node-postgres-connector";

export default (config) => new AuroraDSQLPool(config);

// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Client } from "pg";
import type { DsqlClient } from "./index.js";

declare const clientPg: DsqlClient<Client>;
export default clientPg;

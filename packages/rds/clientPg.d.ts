// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Client } from "pg";
import type { RdsClient } from "./index.js";

declare const clientPg: RdsClient<Client>;
export default clientPg;

// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { join } from "node:path";
import { buildCertificates } from "./buildCertificates.js";

await buildCertificates({ dir: join(import.meta.dirname, "..") });

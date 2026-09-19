// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { PluginExecutionMode } from "./index.js";

/**
 * The context this mode hands to the handler and middlewares. It is the only
 * place `@middy/core` types reach into the optional SDK; the package root
 * describes the same shape structurally as `DurableContextLike`.
 */
export type { DurableContext } from "@aws/durable-execution-sdk-js";
export type { PluginExecutionMode } from "./index.js";
export declare const executionModeDurableContext: PluginExecutionMode;

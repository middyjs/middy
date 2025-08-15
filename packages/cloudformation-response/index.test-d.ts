import type middy from "@middy/core";
import { expect } from "tstyche";

import cloudformationResponse from "./index.js";

// use with default options
const middleware = cloudformationResponse();
expect(middleware).type.toBe<middy.MiddlewareObj>();

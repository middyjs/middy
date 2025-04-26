import type middy from "@middy/core";
import { expectType } from "tsd";

import cloudformationResponse from ".";

// use with default options
const middleware = cloudformationResponse();
expectType<middy.MiddlewareObj>(middleware);

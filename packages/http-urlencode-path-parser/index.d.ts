import type middy from "@middy/core";
import type { APIGatewayEvent } from "aws-lambda";
import type { JsonValue } from "type-fest";

export type Event = APIGatewayEvent & {
	body: JsonValue;
};

declare function urlEncodePathParser(): middy.MiddlewareObj<Event>;

export default urlEncodePathParser;

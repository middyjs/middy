import type middy from "@middy/core";
import type { CloudFormationCustomResourceHandler } from "aws-lambda";

interface Route<T = never> {
	requestType: string;
	handler: CloudFormationCustomResourceHandler<T>;
}

declare function cloudformationRouterHandler(
	routes: Route[],
): middy.MiddyfiedHandler;

export default cloudformationRouterHandler;

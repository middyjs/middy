import type {
	AssumeRoleCommandInput,
	STSClient,
	STSClientConfig,
} from "@aws-sdk/client-sts";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export interface AssumedRoleCredentials {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken: string;
}

export type AssumeRoleCommandInputWithOptionalRoleSessionName = Omit<
	AssumeRoleCommandInput,
	"RoleSessionName"
> & { RoleSessionName?: string | undefined };

interface STSOptions<AwsSTSClient = STSClient>
	extends Pick<
		MiddyOptions<AwsSTSClient, STSClientConfig>,
		| "AwsClient"
		| "awsClientOptions"
		| "awsClientCapture"
		| "disablePrefetch"
		| "cacheKey"
		| "cacheExpiry"
		| "setToContext"
	> {
	fetchData?: {
		[key: string]: AssumeRoleCommandInputWithOptionalRoleSessionName;
	};
}

export type Context<TOptions extends STSOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? LambdaContext & {
					[Key in keyof TFetchData]: AssumedRoleCredentials;
				}
			: never
		: LambdaContext;

export type Internal<TOptions extends STSOptions | undefined> =
	TOptions extends STSOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: AssumedRoleCredentials;
				}
			: {}
		: {};

declare function sts<TOptions extends STSOptions | undefined>(
	options?: TOptions,
): middy.MiddlewareObj<
	unknown,
	any,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export default sts;

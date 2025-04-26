import type {
	SecretsManagerClient,
	SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type SecretType<T> = string & { __returnType?: T };
export declare function secret<T>(path: string): SecretType<T>;

interface SecretsManagerOptions<AwsSecretsManagerClient = SecretsManagerClient>
	extends Omit<
		MiddyOptions<AwsSecretsManagerClient, SecretsManagerClientConfig>,
		"fetchData"
	> {
	fetchData?: { [key: string]: string | SecretType<unknown> };
}

export type Context<TOptions extends SecretsManagerOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? LambdaContext & {
					[Key in keyof TFetchData]: TFetchData[Key] extends SecretType<infer T>
						? T
						: unknown;
				}
			: never
		: LambdaContext;

export type Internal<TOptions extends SecretsManagerOptions | undefined> =
	TOptions extends SecretsManagerOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: TFetchData[Key] extends SecretType<infer T>
						? T
						: unknown;
				}
			: {}
		: {};

declare function secretsManager<
	TOptions extends SecretsManagerOptions | undefined,
>(
	options?: TOptions,
): middy.MiddlewareObj<
	unknown,
	any,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export default secretsManager;

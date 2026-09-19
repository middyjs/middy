// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	GetSchemaVersionCommandInput,
	GlueClient,
	GlueClientConfig,
} from "@aws-sdk/client-glue";
import type middy from "@middy/core";
import type { ContextNamespace, Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamType<T> = string & { __returnType?: T };
export declare function glueSchemaRegistryParam<T>(name: string): ParamType<T>;

export type DataFormat = "AVRO" | "PROTOBUF" | "JSON";

export interface ResolvedSchema {
	schemaVersionId: string;
	schemaDefinition: string;
	dataFormat: DataFormat;
}

export type GlueSchemaFetchInput =
	| (Pick<GetSchemaVersionCommandInput, "SchemaVersionId"> & {
			SchemaVersionId: string;
	  })
	| {
			SchemaId: NonNullable<GetSchemaVersionCommandInput["SchemaId"]>;
			SchemaVersionNumber?: GetSchemaVersionCommandInput["SchemaVersionNumber"];
	  };

export interface GlueSchemaRegistryOptions<AwsGlueClient = GlueClient>
	extends Pick<
		MiddyOptions<AwsGlueClient, GlueClientConfig>,
		| "AwsClient"
		| "awsClientOptions"
		| "awsClientCapture"
		| "disablePrefetch"
		| "cacheKey"
		| "cacheExpiry"
		| "cacheKeyExpiry"
		| "setToContext"
		| "contextKey"
	> {
	awsClientAssumeRole?: string;
	fetchData?: {
		[key: string]: GlueSchemaFetchInput;
	};
}

export type Context<TOptions extends GlueSchemaRegistryOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? ContextNamespace<
					TOptions,
					"glue-schema-registry",
					{ [Key in keyof TFetchData]: ResolvedSchema }
				>
			: LambdaContext
		: LambdaContext;

export type Internal<TOptions extends GlueSchemaRegistryOptions | undefined> =
	TOptions extends GlueSchemaRegistryOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: ResolvedSchema;
				}
			: {}
		: {};

declare function glueSchemaRegistry<
	TOptions extends GlueSchemaRegistryOptions | undefined,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`.
	options?: TOptions & { contextKey?: TKey },
): middy.MiddlewareObj<
	unknown,
	unknown,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function glueSchemaRegistryValidateOptions(
	options?: Record<string, unknown>,
): void;

export declare function resolveSchemaVersion(
	schemaVersionId: string,
	options: GlueSchemaRegistryOptions,
	request: { internal: Record<string, unknown> },
): Promise<ResolvedSchema>;

export default glueSchemaRegistry;

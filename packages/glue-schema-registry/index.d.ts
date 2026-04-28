// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	GetSchemaVersionCommandInput,
	GlueClient,
	GlueClientConfig,
} from "@aws-sdk/client-glue";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamType<T> = string & { __returnType?: T };
export declare function glueSchemaRegistryParam<T>(name: string): ParamType<T>;

export type DataFormat = "AVRO" | "PROTOBUF" | "JSON";

export interface ResolvedSchema {
	schemaVersionId: string;
	schemaDefinition: string;
	dataFormat: DataFormat;
}

export interface SchemaSlotEntry {
	schemaDefinition: string;
	dataFormat: DataFormat;
}

export interface SchemaSlot {
	schemas: Map<string, SchemaSlotEntry>;
	schema: string | undefined;
}

export type GlueSchemaFetchInput =
	| (Pick<GetSchemaVersionCommandInput, "SchemaVersionId"> & {
			SchemaVersionId: string;
	  })
	| {
			SchemaId: NonNullable<GetSchemaVersionCommandInput["SchemaId"]>;
			SchemaVersionNumber?: number;
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
	> {
	awsClientAssumeRole?: string;
	fetchData?: {
		[key: string]: GlueSchemaFetchInput;
	};
}

export type Context<TOptions extends GlueSchemaRegistryOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? LambdaContext & {
					[Key in keyof TFetchData]: ResolvedSchema;
				}
			: LambdaContext
		: LambdaContext;

export type Internal<TOptions extends GlueSchemaRegistryOptions | undefined> =
	TOptions extends GlueSchemaRegistryOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: ResolvedSchema;
				} & { "glue-schema-registry": SchemaSlot }
			: { "glue-schema-registry": SchemaSlot }
		: { "glue-schema-registry": SchemaSlot };

declare function glueSchemaRegistry<
	TOptions extends GlueSchemaRegistryOptions | undefined,
>(
	options?: TOptions,
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

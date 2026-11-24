// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { HttpError } from "@middy/util";

const pkg = "@middy/event-batch-parser";

// "Consumers reading this data use the Schema Registry deserializer library
// that parses the schema version ID from the record payload", and "using the
// schema version ID the deserializer will request the schema from the Schema
// Registry".
// https://docs.aws.amazon.com/glue/latest/dg/schema-registry-works.html
export const assertSchemaVersion = (
	schemaVersionId,
	expectedSchemaVersionId,
) => {
	if (
		schemaVersionId !== undefined &&
		expectedSchemaVersionId !== undefined &&
		schemaVersionId !== expectedSchemaVersionId
	) {
		throw new HttpError(422, {
			cause: {
				package: pkg,
				data: {
					reason: "Schema version mismatch",
					schemaVersionId,
					expectedSchemaVersionId,
				},
			},
		});
	}
};

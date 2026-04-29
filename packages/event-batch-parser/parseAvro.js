// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import avro from "avro-js";

export const parseAvro = (parserOpts = {}) => {
	if (parserOpts.schema) {
		const type = avro.parse(parserOpts.schema);
		return (buffer, _record, _request, framing) =>
			type.fromBuffer(framing?.payload ?? buffer);
	}
	const internalKey = parserOpts.internalKey;
	if (!internalKey) {
		throw new TypeError(
			"parseAvro: requires `schema` or `internalKey` (matching a fetchData key on @middy/glue-schema-registry)",
		);
	}
	return async (buffer, _record, request, framing) => {
		const entry = await request.internal?.[internalKey];
		const schemaDefinition = entry?.schemaDefinition;
		if (!schemaDefinition) {
			throw new TypeError(
				`parseAvro: request.internal["${internalKey}"] is unset — did glue-schema-registry run with a matching fetchData key?`,
			);
		}
		return avro.parse(schemaDefinition).fromBuffer(framing?.payload ?? buffer);
	};
};

export default parseAvro;

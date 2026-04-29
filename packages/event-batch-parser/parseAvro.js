// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import avro from "avro-js";

export const parseAvro = (parserOpts = {}) => {
	if (parserOpts.schema) {
		const type = avro.parse(parserOpts.schema);
		return (buffer, _record, _request, framing) =>
			type.fromBuffer(framing?.payload ?? buffer);
	}
	const contextKey = parserOpts.contextKey;
	if (!contextKey) {
		throw new TypeError(
			"parseAvro: requires `schema` or `contextKey` (matching a fetchData key on @middy/glue-schema-registry with `setToContext: true`)",
		);
	}
	return (buffer, _record, request, framing) => {
		const schemaDefinition = request.context?.[contextKey]?.schemaDefinition;
		if (!schemaDefinition) {
			throw new TypeError(
				`parseAvro: request.context["${contextKey}"] is unset — did glue-schema-registry run with setToContext: true?`,
			);
		}
		return avro.parse(schemaDefinition).fromBuffer(framing?.payload ?? buffer);
	};
};

export default parseAvro;

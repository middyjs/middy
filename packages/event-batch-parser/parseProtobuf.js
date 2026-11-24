// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { assertSchemaVersion } from "./assertSchemaVersion.js";

const pkg = "@middy/event-batch-parser";

// The Glue Protobuf serializer writes the index of the message type as a
// uint32 varint in front of the message, and the deserializer reads it back
// before it parses the message. The index is the position of the type among
// every message type of the schema, nested ones included, sorted by full
// name, so it is always one varint and never a path.
// github.com/awslabs/aws-glue-schema-registry/blob/a81bd845f668f63cc9da8a89c23525e05583c7fe/serializer-deserializer/src/main/java/com/amazonaws/services/schemaregistry/serializers/protobuf/ProtobufWireFormatEncoder.java
// github.com/awslabs/aws-glue-schema-registry/blob/a81bd845f668f63cc9da8a89c23525e05583c7fe/serializer-deserializer/src/main/java/com/amazonaws/services/schemaregistry/deserializers/protobuf/ProtobufWireFormatDecoder.java
// github.com/awslabs/aws-glue-schema-registry/blob/a81bd845f668f63cc9da8a89c23525e05583c7fe/serializer-deserializer/src/main/java/com/amazonaws/services/schemaregistry/serializers/protobuf/MessageIndexFinder.java
const protobufMessageBytes = (buffer, framing) => {
	if (framing?.schemaVersionId === undefined) return framing?.payload ?? buffer;
	const { payload } = framing;
	// A uint32 varint is one to five bytes and its last byte has the high bit
	// clear.
	for (let end = 1; end <= 5; end += 1) {
		if (payload[end - 1] < 0x80) return payload.subarray(end);
	}
	throw new TypeError("parseProtobuf: invalid Glue message index", {
		cause: { package: pkg },
	});
};

export const parseProtobuf = (parserOpts = {}) => {
	if (parserOpts.root && parserOpts.messageType) {
		const Type = parserOpts.root.lookupType(parserOpts.messageType);
		return (buffer, _record, _request, framing) =>
			Type.decode(protobufMessageBytes(buffer, framing)).toJSON();
	}
	const internalKey = parserOpts.internalKey;
	return async (buffer, _record, request, framing) => {
		const entry = internalKey
			? await request.internal?.[internalKey]
			: undefined;
		const root = parserOpts.root ?? entry?.root;
		const messageType = parserOpts.messageType ?? entry?.messageType;
		if (!root || !messageType) {
			throw new TypeError(
				`parseProtobuf: requires { root, messageType } either as factory options or on request.internal["${internalKey}"]`,
				{ cause: { package: pkg, data: { internalKey } } },
			);
		}
		assertSchemaVersion(framing?.schemaVersionId, entry.schemaVersionId);
		return root
			.lookupType(messageType)
			.decode(protobufMessageBytes(buffer, framing))
			.toJSON();
	};
};

export default parseProtobuf;

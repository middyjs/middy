// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

export const parseProtobuf = (parserOpts = {}) => {
	if (parserOpts.root && parserOpts.messageType) {
		const Type = parserOpts.root.lookupType(parserOpts.messageType);
		return (buffer, _record, _request, framing) =>
			Type.decode(framing?.payload ?? buffer).toJSON();
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
			);
		}
		return root
			.lookupType(messageType)
			.decode(framing?.payload ?? buffer)
			.toJSON();
	};
};

export default parseProtobuf;

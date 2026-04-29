// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

export const parseProtobuf = (parserOpts = {}) => {
	if (parserOpts.root && parserOpts.messageType) {
		const Type = parserOpts.root.lookupType(parserOpts.messageType);
		return (buffer, _record, _request, framing) =>
			Type.decode(framing?.payload ?? buffer).toJSON();
	}
	const contextKey = parserOpts.contextKey;
	return (buffer, _record, request, framing) => {
		const slot = contextKey ? request.context?.[contextKey] : undefined;
		const root = parserOpts.root ?? slot?.root;
		const messageType = parserOpts.messageType ?? slot?.messageType;
		if (!root || !messageType) {
			throw new TypeError(
				`parseProtobuf: requires { root, messageType } either as factory options or on request.context["${contextKey}"]`,
			);
		}
		return root
			.lookupType(messageType)
			.decode(framing?.payload ?? buffer)
			.toJSON();
	};
};

export default parseProtobuf;

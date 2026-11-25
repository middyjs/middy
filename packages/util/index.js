// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

// Option validation helper.
// Schema values:
//   'string' | 'number' | 'integer' | 'boolean' | 'null' | 'function'
//   | 'object' | 'array'
//     Trailing '?' marks the field as optional (may be undefined).
//   `type` may also be an array of distinct names; the value matches any.
//   Each keyword constrains only the type it targets: `pattern` ignores a
//   number, `minimum` ignores a string.
//   (value) => boolean predicate - only called when value is not undefined
//     (i.e. predicates treat the field as optional by design).
//   { type: 'array' | 'array?', items: <itemSchema> }
//     `items` is applied to each array element. It can be a type string,
//     a predicate function, or a plain object treated as a per-element
//     object schema (validated recursively with the same rules).
//   { type: '<type>' | '<type>?', minimum?, maximum?, exclusiveMinimum?,
//     exclusiveMaximum?, minLength?, maxLength?, pattern? }
//     Numeric: `minimum`/`maximum` (inclusive), `exclusiveMinimum`/
//     `exclusiveMaximum` (exclusive).
//     String: `minLength`/`maxLength` (string length), `pattern` (a RegExp
//     literal, written with the `u` flag for JSON Schema semantics).
//   { type: 'array' | 'array?', minItems?, maxItems?, uniqueItems?,
//     unevaluatedItems? }
//     `minItems`/`maxItems` bound the array length (inclusive).
//     `uniqueItems: true` rejects an item equal to an earlier one: arrays and
//     plain objects compare deeply, anything else by identity.
//     `unevaluatedItems` may only be `false`, next to `items`.
//   { type: 'object' | 'object?', properties?: {...}, required?: [...],
//     patternProperties?: {...}, additionalProperties?: <rule>,
//     unevaluatedProperties?, propertyNames?, maxProperties? }
//     `properties` validates known keys with the flat-schema form.
//     `patternProperties` validates the value of every key its regex matches.
//     `additionalProperties` validates every key neither matches against the
//     given rule (string, predicate, or nested object schema). Without it,
//     unknown keys throw. `unevaluatedProperties` may only be `false`, next
//     to `additionalProperties`. `propertyNames` validates every key.
//     `maxProperties` bounds the number of keys.
//   { enum: [...values] } | { const: value } | { $ref: '#/$defs/<global class>' }
//   | { oneOf: [...rules] } | { allOf: [...rules] }
//     Value must strict-equal one of the listed values, strict-equal the
//     constant, be an instance of the class, match exactly one rule, or match
//     every rule. Optional by default; combine with `type` to require a
//     specific type and/or presence.
//   The root may carry `$schema` (2020-12 only), `$id` (non-empty), and
//   `$defs` whose entries are `false` and named after a global class.
//   A plain object without `type`, `enum`, `const`, `$ref`, `oneOf` or
//   `allOf` is a flat schema only as `items`, `additionalProperties` or a
//   `patternProperties` value; anywhere else its keys must be keywords.
// Keys in `options` (or nested objects) that are not in `schema` throw,
// catching typos.

const name = "util";
const pkg = `@middy/${name}`;

const validateOptionsTypeCheckers = {
	string: (v) => typeof v === "string",
	number: (v) => typeof v === "number" && !Number.isNaN(v),
	integer: (v) => Number.isInteger(v),
	boolean: (v) => typeof v === "boolean",
	null: (v) => v === null,
	function: (v) => typeof v === "function",
	object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
	array: (v) => Array.isArray(v),
};

const isPlainObject = (v) =>
	v !== null && typeof v === "object" && !Array.isArray(v);

const checkSchemaObject = (schema, options, path, fail) => {
	if (!isPlainObject(options)) {
		fail(
			path ? `Option '${path}' must be object` : "options must be an object",
		);
	}
	for (const key of Object.keys(options)) {
		if (!Object.hasOwn(schema, key)) {
			fail(`Unknown option '${childPathOf(path, key)}'`);
		}
	}
	for (const key of Object.keys(schema)) {
		checkRule(schema[key], safeGet(options, key), childPathOf(path, key), fail);
	}
};

// Returns true if type check passed (and value is defined), false if the
// caller should stop validating (value was undefined and optional).
const checkTypeSpec = (rawType, value, path, fail) => {
	const optional = rawType.endsWith("?");
	const type = optional ? rawType.slice(0, -1) : rawType;
	if (!Object.hasOwn(validateOptionsTypeCheckers, type)) {
		schemaFail(`Unknown schema type '${type}' for option '${path}'`);
	}
	if (value === undefined) {
		if (!optional) fail(`Missing required option '${path}' (${type})`);
		return false;
	}
	if (!validateOptionsTypeCheckers[type](value)) {
		fail(`Option '${path}' must be ${type}`);
	}
	return true;
};

const checkTypeList = (types, value, path, fail) => {
	const expected = types.join(" or ");
	if (value === undefined) {
		fail(`Missing required option '${path}' (${expected})`);
	}
	if (!types.some((type) => validateOptionsTypeCheckers[type](value))) {
		fail(`Option '${path}' must be ${expected}`);
	}
};

const checkTypeListSchema = (types, where) => {
	if (types.length === 0) {
		schemaFail(`'type' must list at least one type in the schema for ${where}`);
	}
	const listed = new Set();
	for (const type of types) {
		if (!Object.hasOwn(validateOptionsTypeCheckers, type)) {
			schemaFail(`Unknown schema type '${type}' in the schema for ${where}`);
		}
		if (listed.has(type)) {
			schemaFail(`Duplicate schema type '${type}' in the schema for ${where}`);
		}
		listed.add(type);
	}
};

const ruleKeywords = new Set([
	"$ref",
	"type",
	"const",
	"enum",
	"allOf",
	"oneOf",
	"not",
	"minimum",
	"maximum",
	"exclusiveMinimum",
	"exclusiveMaximum",
	"pattern",
	"minLength",
	"maxLength",
	"items",
	"minItems",
	"maxItems",
	"uniqueItems",
	"unevaluatedItems",
	"properties",
	"required",
	"additionalProperties",
	"unevaluatedProperties",
	"propertyNames",
	"patternProperties",
	"maxProperties",
	"examples",
]);

const unevaluatedKeywordSiblings = new Map([
	["unevaluatedItems", "items"],
	["unevaluatedProperties", "additionalProperties"],
]);

const checkRuleKeywords = (rule, path, seen, refs, allowsFlatSchema) => {
	if (!isPlainObject(rule) || seen.has(rule)) return;
	seen.add(rule);
	if (allowsFlatSchema && !hasRuleMarker(rule)) {
		checkSchemaObjectKeywords(rule, path, seen, refs);
		return;
	}
	const where = describeOption(path);
	for (const keyword of Object.keys(rule)) {
		if (!ruleKeywords.has(keyword)) {
			schemaFail(
				`Unknown schema keyword '${keyword}' in the schema for ${where}`,
			);
		}
		if (keyword === "$ref" && !refs.has(rule.$ref)) {
			schemaFail(`Unknown '$ref' '${rule.$ref}' in the schema for ${where}`);
		}
		const sibling = unevaluatedKeywordSiblings.get(keyword);
		if (
			sibling !== undefined &&
			(rule[keyword] !== false || rule[sibling] === undefined)
		) {
			schemaFail(
				`'${keyword}' must be false next to '${sibling}' in the schema for ${where}`,
			);
		}
	}
	const {
		type,
		properties,
		patternProperties,
		items,
		additionalProperties,
		propertyNames,
		allOf,
		oneOf,
	} = rule;
	if (Array.isArray(type)) checkTypeListSchema(type, where);
	if (rule.pattern !== undefined && !(rule.pattern instanceof RegExp)) {
		schemaFail(`'pattern' must be a RegExp in the schema for ${where}`);
	}
	if (properties) checkSchemaObjectKeywords(properties, path, seen, refs);
	for (const [, patternRule, source] of compilePatternProperties(
		patternProperties,
		where,
	)) {
		checkRuleKeywords(patternRule, childPathOf(path, source), seen, refs, true);
	}
	checkRuleKeywords(items, `${path}[]`, seen, refs, true);
	checkRuleKeywords(
		additionalProperties,
		childPathOf(path, "*"),
		seen,
		refs,
		true,
	);
	checkRuleKeywords(propertyNames, path, seen, refs);
	if (Array.isArray(allOf)) {
		for (const sub of allOf) checkRuleKeywords(sub, path, seen, refs);
	}
	if (Array.isArray(oneOf)) {
		for (const sub of oneOf) checkRuleKeywords(sub, path, seen, refs);
	}
	checkRuleKeywords(rule.not, path, seen, refs);
};

const checkSchemaObjectKeywords = (schema, path, seen, refs) => {
	for (const key of Object.keys(schema)) {
		checkRuleKeywords(schema[key], childPathOf(path, key), seen, refs);
	}
};

const hasRuleMarker = (rule) =>
	Object.hasOwn(rule, "$ref") ||
	typeof rule.type === "string" ||
	Array.isArray(rule.type) ||
	Array.isArray(rule.enum) ||
	Array.isArray(rule.oneOf) ||
	Array.isArray(rule.allOf) ||
	Object.hasOwn(rule, "const");

const checkNestedRule = (rule, value, path, fail) => {
	if (isPlainObject(rule) && !hasRuleMarker(rule)) {
		checkSchemaObject(rule, value, path, fail);
	} else {
		checkRule(rule, value, path, fail);
	}
};

const childPathOf = (path, key) => (path ? `${path}.${key}` : key);

// Keys that reach an object's prototype chain when assigned.
export const reservedPropertyNames = ["__proto__", "constructor", "prototype"];

const describeOption = (path) => (path ? `option '${path}'` : "options");

const compilePatternProperties = (patternProperties, where) => {
	const compiled = [];
	for (const [source, rule] of Object.entries(patternProperties ?? {})) {
		try {
			compiled.push([new RegExp(source, "u"), rule, source]);
		} catch {
			schemaFail(
				`Invalid pattern '${source}' in patternProperties in the schema for ${where}`,
			);
		}
	}
	return compiled;
};

class SchemaError extends Error {}
const schemaFail = (message) => {
	throw new SchemaError(message);
};

const resolveInstance = (name) => {
	const ctor = globalThis[name];
	if (typeof ctor !== "function") {
		schemaFail(`Unknown '$defs' class '${name}'`);
	}
	return ctor;
};

const checkRule = (rule, value, path, fail) => {
	if (typeof rule === "function") {
		if (value !== undefined && !rule(value)) {
			fail(`Invalid option '${path}'`);
		}
		return;
	}
	if (typeof rule === "string") {
		checkTypeSpec(rule, value, path, fail);
		return;
	}
	if (!isPlainObject(rule) || !hasRuleMarker(rule)) {
		schemaFail(`Invalid schema for option '${path}'`);
	}
	if (typeof rule.type === "string") {
		if (!checkTypeSpec(rule.type, value, path, fail)) return;
	} else if (Array.isArray(rule.type)) {
		checkTypeList(rule.type, value, path, fail);
	} else if (value === undefined) {
		return;
	}
	if (Object.hasOwn(rule, "const") && value !== rule.const) {
		fail(`Option '${path}' must equal ${JSON.stringify(rule.const)}`);
	}
	if (Array.isArray(rule.enum) && !rule.enum.includes(value)) {
		fail(`Option '${path}' must be one of ${JSON.stringify(rule.enum)}`);
	}
	if (Object.hasOwn(rule, "$ref")) {
		const name = rule.$ref.slice(defsRefPrefix.length);
		if (!(value instanceof globalThis[name])) {
			fail(`Option '${path}' must be instanceof ${name}`);
		}
	}
	if (Array.isArray(rule.allOf)) {
		for (const sub of rule.allOf) {
			checkRule(sub, value, path, fail);
		}
	}
	if (Array.isArray(rule.oneOf)) {
		let matches = 0;
		for (const sub of rule.oneOf) {
			if (matchesRule(sub, value, path)) matches++;
		}
		if (matches !== 1) {
			fail(`Option '${path}' must match exactly one schema in oneOf`);
		}
	}
	if (Object.hasOwn(rule, "not") && matchesRule(rule.not, value, path)) {
		fail(`Option '${path}' must not match the schema in not`);
	}
	checkNumberKeywords(rule, value, path, fail);
	checkStringKeywords(rule, value, path, fail);
	checkArrayKeywords(rule, value, path, fail);
	checkObjectKeywords(rule, value, path, fail);
};

const matchesRule = (rule, value, path) => {
	try {
		checkRule(rule, value, path, (msg) => {
			throw new TypeError(msg);
		});
		return true;
	} catch (e) {
		if (e instanceof SchemaError) throw e;
		return false;
	}
};

const checkNumberKeywords = (rule, value, path, fail) => {
	if (typeof value !== "number") return;
	const { minimum, maximum, exclusiveMinimum, exclusiveMaximum } = rule;
	if (value < minimum) {
		fail(`Option '${path}' must be >= ${minimum}`);
	}
	if (value > maximum) {
		fail(`Option '${path}' must be <= ${maximum}`);
	}
	if (value <= exclusiveMinimum) {
		fail(`Option '${path}' must be > ${exclusiveMinimum}`);
	}
	if (value >= exclusiveMaximum) {
		fail(`Option '${path}' must be < ${exclusiveMaximum}`);
	}
};

const checkStringKeywords = (rule, value, path, fail) => {
	if (typeof value !== "string") return;
	const { pattern, minLength, maxLength } = rule;
	if (value.match(pattern) === null) {
		fail(`Option '${path}' must match pattern ${pattern}`);
	}
	if (value.length < minLength) {
		fail(`Option '${path}' must have length >= ${minLength}`);
	}
	if (value.length > maxLength) {
		fail(`Option '${path}' must have length <= ${maxLength}`);
	}
};

const checkArrayKeywords = (rule, value, path, fail) => {
	if (!Array.isArray(value)) return;
	const { items, minItems, maxItems, uniqueItems } = rule;
	if (value.length < minItems) {
		fail(`Option '${path}' must have >= ${minItems} items`);
	}
	if (value.length > maxItems) {
		fail(`Option '${path}' must have <= ${maxItems} items`);
	}
	for (let i = 0; i < value.length; i++) {
		if (items !== undefined) {
			checkNestedRule(items, value[i], `${path}[${i}]`, fail);
		}
		if (
			uniqueItems === true &&
			value.slice(0, i).some((earlier) => jsonEqual(value[i], earlier))
		) {
			fail(`Duplicate item at '${path}[${i}]'`);
		}
	}
};

const isJsonObject = (value) => {
	if (value === null || typeof value !== "object") return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};

const jsonEqual = (a, b) => {
	if (Array.isArray(a)) {
		return (
			Array.isArray(b) &&
			a.length === b.length &&
			a.every((item, i) => jsonEqual(item, b[i]))
		);
	}
	if (isJsonObject(a)) {
		if (!isJsonObject(b)) return false;
		const keys = Object.keys(a);
		return (
			keys.length === Object.keys(b).length &&
			keys.every((key) => Object.hasOwn(b, key) && jsonEqual(a[key], b[key]))
		);
	}
	return a === b;
};

const checkObjectKeywords = (rule, value, path, fail) => {
	if (!isPlainObject(value)) return;
	const {
		properties,
		patternProperties,
		required,
		additionalProperties,
		propertyNames,
		maxProperties,
	} = rule;
	if (Array.isArray(required)) {
		for (const key of required) {
			if (safeGet(value, key) === undefined) {
				fail(`Missing required option '${childPathOf(path, key)}'`);
			}
		}
	}
	const keys = Object.keys(value);
	if (keys.length > maxProperties) {
		fail(`Option '${path}' must have <= ${maxProperties} properties`);
	}
	const closed =
		properties || patternProperties || additionalProperties !== undefined;
	const patterns = compilePatternProperties(
		patternProperties,
		describeOption(path),
	);
	for (const key of keys) {
		const keyPath = childPathOf(path, key);
		if (propertyNames !== undefined) {
			checkRule(propertyNames, key, keyPath, (message) =>
				fail(
					`Invalid property name '${key}' in ${describeOption(path)}: ${message}`,
				),
			);
		}
		let evaluated = properties && Object.hasOwn(properties, key);
		for (const [regex, patternRule] of patterns) {
			if (regex.test(key)) {
				evaluated = true;
				checkNestedRule(patternRule, value[key], keyPath, fail);
			}
		}
		if (!closed || evaluated) continue;
		if (additionalProperties === undefined || additionalProperties === false) {
			fail(`Unknown option '${keyPath}'`);
		}
		if (additionalProperties === true) continue;
		checkNestedRule(additionalProperties, value[key], keyPath, fail);
	}
	if (properties) {
		for (const key of Object.keys(properties)) {
			const propertyValue = safeGet(value, key);
			if (propertyValue === undefined) continue;
			checkRule(properties[key], propertyValue, childPathOf(path, key), fail);
		}
	}
};

const isJsonSchemaForm = (schema) =>
	isPlainObject(schema) &&
	schema.type === "object" &&
	(Object.hasOwn(schema, "properties") ||
		Object.hasOwn(schema, "required") ||
		Object.hasOwn(schema, "additionalProperties"));

const draft202012 = "https://json-schema.org/draft/2020-12/schema";
const defsRefPrefix = "#/$defs/";

// A `$defs` entry is `false`, which a JSON Schema validator reads as "no JSON
// value is valid"; util reads its name as `instanceof globalThis[name]`. For
// Function and RegExp the readings agree on every JSON value. `Object` also
// passes plain objects and arrays in util, so util is the looser reader there;
// use it only for live instances such as clients.
const checkRootKeywords = ($schema, $id, $defs) => {
	if ($schema !== undefined && $schema !== draft202012) {
		schemaFail(`'$schema' must be '${draft202012}'`);
	}
	if ($id !== undefined && (typeof $id !== "string" || $id === "")) {
		schemaFail("'$id' must be a non-empty string");
	}
	const refs = new Set();
	for (const [name, def] of Object.entries($defs ?? {})) {
		if (def !== false) schemaFail(`'$defs' entry '${name}' must be false`);
		resolveInstance(name);
		refs.add(`${defsRefPrefix}${name}`);
	}
	return refs;
};

export const validateOptions = (packageName, schema, options = {}) => {
	const fail = (message) => {
		throw new TypeError(message, { cause: { package: packageName } });
	};
	try {
		if (isJsonSchemaForm(schema)) {
			const { $schema, $id, $defs, ...rule } = schema;
			const refs = checkRootKeywords($schema, $id, $defs);
			checkRuleKeywords(rule, "", new WeakSet(), refs);
			if (!isPlainObject(options)) fail("options must be an object");
			checkRule(rule, options, "", fail);
		} else {
			checkSchemaObjectKeywords(schema, "", new WeakSet(), new Set());
			checkSchemaObject(schema, options, "", fail);
		}
	} catch (e) {
		// Re-wrap an internal malformed-schema `SchemaError` so callers still see
		// the documented `TypeError` + `cause.package`; mismatch errors already
		// carry that shape and pass through untouched, as does an error a
		// predicate threw.
		if (e instanceof SchemaError) {
			fail(e.message);
		}
		throw e;
	}
	return options;
};

const functionRule = { $ref: "#/$defs/Function" };
const instanceRule = { $ref: "#/$defs/Object" };
const booleanRule = { type: "boolean" };
const printableTextRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x20-\x7E]+$/u,
};
const optionalTextRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x20-\x7E]*$/u,
};
const visibleTextRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
};
const httpHeaderNameRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\w-]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};
const visibleKeyRule = {
	...visibleTextRule,
	not: { type: "string", enum: reservedPropertyNames },
};
const authSchemeIdRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\w.#-]+$/u,
};
const apiVersionRule = {
	type: "string",
	maxLength: 10,
	pattern: /^\d{4}-\d{2}-\d{2}$/u,
};
// The SDK takes any region that is a valid host label:
// node_modules/@smithy/core/dist-es/submodules/transport/isValidHostLabel.js
const awsRegionRule = {
	type: "string",
	maxLength: 63,
	pattern: /^[A-Za-z0-9-]+$/u,
};

const orProvider = (rule) => ({ oneOf: [rule, functionRule] });
const listOf = (items) => ({
	type: "array",
	items,
	maxItems: 1024,
	uniqueItems: true,
	unevaluatedItems: false,
});
const objectOf = (properties, required = []) => ({
	type: "object",
	properties,
	required,
	additionalProperties: false,
	unevaluatedProperties: false,
});
const mapOf = (propertyNames, additionalProperties) => ({
	type: "object",
	propertyNames,
	maxProperties: 1024,
	required: [],
	additionalProperties,
	unevaluatedProperties: false,
});

// node_modules/@smithy/types/dist-types/identity/awsCredentialIdentity.d.ts
const awsCredentialIdentityRule = objectOf(
	{
		// https://docs.aws.amazon.com/IAM/latest/APIReference/API_AccessKey.html
		accessKeyId: { type: "string", maxLength: 128, pattern: /^\w+$/u },
		secretAccessKey: visibleTextRule,
		// "The size of the security token that AWS STS API operations return is
		// not fixed."
		// https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
		sessionToken: { ...visibleTextRule, maxLength: 16384 },
		credentialScope: visibleTextRule,
		// https://docs.aws.amazon.com/accounts/latest/reference/manage-acct-identifiers.html
		accountId: {
			type: "string",
			minLength: 12,
			maxLength: 12,
			pattern: /^\d+$/u,
		},
		expiration: instanceRule,
	},
	["accessKeyId", "secretAccessKey"],
);

// node_modules/@smithy/types/dist-types/http.d.ts (Endpoint)
const endpointV1Rule = objectOf(
	{
		protocol: { type: "string", maxLength: 6, pattern: /^https?:?$/u },
		// RFC 1035 section 2.3.4: "names - 255 octets or less"
		hostname: { ...visibleTextRule, maxLength: 255 },
		port: { type: "integer", minimum: 1, maximum: 65535 },
		path: { type: "string", maxLength: 1024, pattern: /^\/[\x21-\x7E]*$/u },
		// QueryParameterBag: Record<string, string | Array<string> | null>
		query: mapOf(visibleKeyRule, {
			...optionalTextRule,
			...listOf(optionalTextRule),
			type: ["string", "array", "null"],
		}),
		headers: mapOf(httpHeaderNameRule, optionalTextRule),
	},
	["protocol", "hostname", "path"],
);

// node_modules/@smithy/types/dist-types/endpoint.d.ts (EndpointV2)
const endpointV2Rule = objectOf(
	{
		url: instanceRule,
		headers: mapOf(httpHeaderNameRule, listOf(optionalTextRule)),
	},
	["url"],
);

// The keys every client's `<Service>ClientConfigType` shares, e.g.
// node_modules/@aws-sdk/client-ssm/dist-types/SSMClient.d.ts
export const awsClientOptionsSchema = objectOf({
	apiVersion: apiVersionRule,
	authSchemePreference: orProvider(listOf(authSchemeIdRule)),
	base64Decoder: functionRule,
	base64Encoder: functionRule,
	bodyLengthChecker: functionRule,
	cacheMiddleware: booleanRule,
	credentialDefaultProvider: functionRule,
	credentials: orProvider(awsCredentialIdentityRule),
	customUserAgent: {
		oneOf: [
			printableTextRule,
			listOf({ ...listOf(printableTextRule), minItems: 1, maxItems: 2 }),
		],
	},
	defaultUserAgentProvider: functionRule,
	defaultsMode: orProvider({
		type: "string",
		enum: ["standard", "in-region", "cross-region", "mobile", "auto", "legacy"],
	}),
	disableClockSkewCorrection: orProvider(booleanRule),
	disableHostPrefix: booleanRule,
	endpoint: {
		oneOf: [
			{
				type: "string",
				maxLength: 1024,
				pattern: /^https?:\/\/[\x21-\x7E]+$/u,
			},
			functionRule,
			endpointV1Rule,
			endpointV2Rule,
		],
	},
	endpointProvider: functionRule,
	extensions: listOf(objectOf({ configure: functionRule }, ["configure"])),
	httpAuthSchemeProvider: functionRule,
	httpAuthSchemes: listOf(
		objectOf(
			{
				schemeId: authSchemeIdRule,
				identityProvider: functionRule,
				signer: instanceRule,
			},
			["schemeId", "identityProvider", "signer"],
		),
	),
	ignoreConfiguredEndpointUrls: booleanRule,
	logger: instanceRule,
	maxAttempts: orProvider({
		type: "integer",
		minimum: 1,
		maximum: Number.MAX_SAFE_INTEGER,
	}),
	profile: visibleTextRule,
	protocol: instanceRule,
	// The settings every client's runtimeConfig.shared.js passes its protocol:
	// node_modules/@aws-sdk/client-ssm/dist-es/runtimeConfig.shared.js
	protocolSettings: objectOf({
		awsQueryCompatible: booleanRule,
		defaultNamespace: visibleTextRule,
		errorTypeRegistries: listOf(instanceRule),
		jsonCodec: instanceRule,
		serviceTarget: visibleTextRule,
		version: apiVersionRule,
		xmlNamespace: visibleTextRule,
	}),
	region: orProvider(awsRegionRule),
	requestHandler: instanceRule,
	// node_modules/@smithy/core/dist-types/submodules/retry/util-retry/config.d.ts
	retryMode: orProvider({ type: "string", enum: ["standard", "adaptive"] }),
	retryStrategy: instanceRule,
	runtime: { type: "string", enum: ["node", "browser", "react-native"] },
	serviceId: printableTextRule,
	sha256: functionRule,
	signer: instanceRule,
	signerConstructor: functionRule,
	signingEscapePath: booleanRule,
	signingRegion: awsRegionRule,
	streamCollector: functionRule,
	// ECMA-262 section 21.4.1.1: a time value is within 8.64e15 ms of the epoch
	systemClockOffset: { type: "number", minimum: -8.64e15, maximum: 8.64e15 },
	tls: booleanRule,
	urlParser: functionRule,
	useDualstackEndpoint: orProvider(booleanRule),
	useFipsEndpoint: orProvider(booleanRule),
	// The SDK warns past 50 characters:
	// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-user-agent/configurations.js
	userAgentAppId: orProvider({ ...printableTextRule, maxLength: 50 }),
	utf8Decoder: functionRule,
	utf8Encoder: functionRule,
});

const cacheExpiryRule = {
	type: "number",
	minimum: -1,
	maximum: Number.MAX_SAFE_INTEGER,
};

export const cacheOptionSchemaProperties = {
	disablePrefetch: booleanRule,
	cacheKey: visibleTextRule,
	cacheKeyExpiry: mapOf(visibleKeyRule, cacheExpiryRule),
	cacheExpiry: cacheExpiryRule,
	cacheMaxSize: {
		type: "integer",
		minimum: 1,
		maximum: Number.MAX_SAFE_INTEGER,
	},
};

export const createPrefetchClient = (options) => {
	const { awsClientOptions } = options;
	const client = new options.AwsClient(awsClientOptions);

	if (options.awsClientCapture) {
		return options.awsClientCapture(client);
	}

	return client;
};

export const createClient = async (options, request) => {
	let awsClientCredentials = {};

	// Role Credentials
	if (options.awsClientAssumeRole) {
		// The credentials live in `request.internal`; without it the client would
		// silently be built on the function's own role.
		if (!request?.internal) {
			throw new Error("Request required when assuming role", {
				cause: { package: pkg },
			});
		}
		awsClientCredentials = await getInternal(
			{ credentials: options.awsClientAssumeRole },
			request,
		);
		// A mistyped key, or sts ordered after this middleware, resolves to
		// undefined, which would equally fall back to the function's own role.
		if (typeof awsClientCredentials.credentials === "undefined") {
			throw new Error("Credentials missing for assumed role", {
				cause: {
					package: pkg,
					data: { awsClientAssumeRole: options.awsClientAssumeRole },
				},
			});
		}
	}

	awsClientCredentials = {
		...awsClientCredentials,
		...options.awsClientOptions,
	};

	return createPrefetchClient({
		...options,
		awsClientOptions: awsClientCredentials,
	});
};

// Memoized client initialisation for the warm path. A rejected attempt is
// forgotten so the next invocation retries instead of replaying the same
// failure for the life of the container. With `awsClientAssumeRole` the memo
// is keyed on the credential value sts stored in `request.internal` (the same
// promise object until sts refetches), so refreshed credentials rebuild the
// client instead of it keeping the first invocation's, by then expired, session.
export const createClientInit = (options) => {
	const { awsClientAssumeRole } = options;
	let pending;
	let credentials;
	return (request) => {
		// A request without `internal` is left to createClient, which rejects
		// with the packaged error rather than throwing here synchronously.
		// Without awsClientAssumeRole the key is undefined, the read yields
		// undefined on every request and the memo is never reset.
		const current = request?.internal?.[awsClientAssumeRole];
		if (current !== credentials) {
			credentials = current;
			pending = undefined;
		}
		if (pending === undefined) {
			// Only the current attempt is forgotten on failure: one superseded by
			// refetched credentials may still reject after its replacement began.
			const attempt = createClient(options, request).catch((e) => {
				if (pending === attempt) pending = undefined;
				throw e;
			});
			pending = attempt;
		}
		return pending;
	};
};

// Every fetch middleware calls this once at construction, so it also rejects
// a cacheExpiry that can only be a mistyped duration: above 24h it is read as
// a unix timestamp, and one before 2001-01-01 (~31 years of ms, older than
// Lambda) is a duration over 24h (25h lands in 1970) that would silently
// disable the cache. A real timestamp that has passed is just an expired
// entry, so a deployment keeps booting after its configured date.
const minTimestampCacheExpiry = 978307200000;

export const canPrefetch = (options = {}) => {
	const cacheExpiry =
		options.cacheKeyExpiry?.[options.cacheKey] ?? options.cacheExpiry;
	if (cacheExpiry > 86400000 && cacheExpiry < minTimestampCacheExpiry) {
		throw new Error(
			`Invalid cacheExpiry value: ${cacheExpiry}. Values above 86400000 (24h) are unix timestamps (ms), and one before 2001-01-01 (978307200000) is a duration over 24h; use at most 86400000, -1 (infinite) or a real timestamp`,
			{ cause: { package: pkg } },
		);
	}
	// X-Ray cannot "record work done outside of the handler invocation scope"
	// (https://docs.aws.amazon.com/lambda/latest/dg/services-xray.html), and a
	// client built for the prefetch is kept for the life of the container. A
	// capture function therefore turns prefetch off: the client is built and
	// captured inside the first invocation, and every fetch is traced.
	return (
		!options.awsClientAssumeRole &&
		!options.awsClientCapture &&
		!options.disablePrefetch &&
		cacheExpiry !== 0
	);
};

const safeGet = (obj, key) =>
	obj !== undefined && obj !== null && Object.hasOwn(obj, key)
		? obj[key]
		: undefined;

// `sanitizeKey` maps e.g. `a.b`, `a_b` and `a-b` all to `a_b`, so two
// requested keys can land on the same output name and one value would
// silently overwrite the other. Callers detect the collision on write (an
// `in` check against the null-prototype output) and build the error here,
// off the hot path, listing every requested key that collides.
const duplicateSanitizedKeyError = (keys, sanitized) => {
	const collisions = keys.filter((key) => sanitizeKey(key) === sanitized);
	return new TypeError(
		`Keys ${collisions.map((key) => `"${key}"`).join(", ")} sanitize to the same name "${sanitized}"`,
		{ cause: { package: pkg, data: { keys: collisions } } },
	);
};

// Internal Context
export const getInternal = async (variables, request) => {
	if (!variables || !request?.internal) return Object.create(null);
	let keys;
	let values;
	// All-keys mode reads each real key name as-is: a stored key such as
	// "db.password" is a name, not a path, so it must not be split on ".".
	const keysArePaths = variables !== true;
	if (!keysArePaths) {
		keys = values = Object.keys(request.internal);
	} else if (typeof variables === "string") {
		keys = values = [variables];
	} else if (Array.isArray(variables)) {
		keys = values = variables;
	} else if (typeof variables === "object") {
		keys = Object.keys(variables);
		values = Object.values(variables);
	} else {
		return Object.create(null);
	}
	// Fast synchronous path: when every internal value is already resolved
	// (warm/cached invocations) the result is built without any Promise
	// machinery, so the returned promise is already settled and an `await` on
	// it costs no extra microtask hop. The first pending value hands over to
	// the async fallback below, which produces the same output.
	const obj = Object.create(null);
	let allSync = true;
	for (let i = 0; i < values.length; i++) {
		const internalKey = values[i];
		const dotIndex = keysArePaths ? internalKey.indexOf(".") : -1;
		const rootKey =
			dotIndex === -1 ? internalKey : internalKey.substring(0, dotIndex);
		let value = request.internal[rootKey];
		if (isPromise(value)) {
			allSync = false;
			break;
		}
		if (dotIndex !== -1) {
			for (const part of internalKey.substring(dotIndex + 1).split(".")) {
				value = safeGet(value, part);
			}
			if (isPromise(value)) {
				allSync = false;
				break;
			}
		}
		const sanitized = sanitizeKey(keys[i]);
		if (sanitized in obj) throw duplicateSanitizedKeyError(keys, sanitized);
		obj[sanitized] = value;
	}
	if (allSync) return obj;

	// Async fallback: for cold/first invocations with pending promises
	const promises = [];
	for (const internalKey of values) {
		// 'internal.key.sub_value' -> { [key]: internal.key.sub_value }
		const pathOptionKey = keysArePaths ? internalKey.split(".") : [internalKey];
		const rootOptionKey = pathOptionKey.shift();
		// Promise.resolve hands a native promise back unchanged, so a resolved
		// value and a pending one take the same path.
		promises.push(
			Promise.resolve(request.internal[rootOptionKey]).then((value) =>
				pathOptionKey.reduce(safeGet, value),
			),
		);
	}
	// ensure promise has resolved by the time it's needed
	// If one of the promises throws it will bubble up to @middy/core
	values = await Promise.allSettled(promises);
	const resolved = Object.create(null);
	let errors;
	for (let i = 0; i < keys.length; i++) {
		if (values[i].status === "rejected") {
			errors ??= [];
			errors.push(values[i].reason);
		} else {
			const sanitized = sanitizeKey(keys[i]);
			if (sanitized in resolved) {
				throw duplicateSanitizedKeyError(keys, sanitized);
			}
			resolved[sanitized] = values[i].value;
		}
	}
	if (errors) {
		throw new AggregateError(errors, "Failed to resolve internal values", {
			cause: { package: pkg },
		});
	}
	return resolved;
};

const isPromise = (promise) => typeof promise?.then === "function";

const sanitizeKeyPrefixLeadingNumber = /^([0-9])/;
const sanitizeKeyRemoveDisallowedChar = /[^a-zA-Z0-9]+/g;
const sanitizeKeyCache = new Map();
const sanitizeKeyCacheMaxSize = 1024;
export const sanitizeKey = (key) => {
	let sanitized = sanitizeKeyCache.get(key);
	if (sanitized === undefined) {
		sanitized = key
			.replace(sanitizeKeyPrefixLeadingNumber, "_$1")
			.replace(sanitizeKeyRemoveDisallowedChar, "_");
		// Flushed when full rather than frozen, so a container that sees more
		// distinct keys than the cap keeps memoizing the recent ones.
		// ponytail: whole-cache flush, swap for LRU if the recompute bursts matter.
		if (sanitizeKeyCache.size === sanitizeKeyCacheMaxSize) {
			sanitizeKeyCache.clear();
		}
		sanitizeKeyCache.set(key, sanitized);
	}
	return sanitized;
};

// Resolve the API Gateway / VPC Lattice event "version" used by the HTTP
// router and event normalizer to dispatch event-shape handling:
//   - explicit `event.version` ("1.0" | "2.0") wins, so a VPC Lattice V2
//     event (`version: "2.0"`, top-level `method`) resolves to "2.0" and
//     consumers tell it apart by the missing `requestContext.http`
//   - otherwise a VPC Lattice V1 event (identified by `event.method`) -> "vpc"
//   - else default to "1.0" (the safer default)
// https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html
export const resolveHttpEventVersion = (event) => {
	// '1.0' is a safer default
	return event.version ?? (event.method ? "vpc" : "1.0");
};

// Handler-facing namespace on the Lambda context.
//
// Middleware publish to `context.middyContext[contextKey]` (contextKey defaults to
// the package name without the `@middy/` scope) instead of the context root,
// so a fetched value named `functionName` can't clobber the AWS context.
// `@middy/core` seeds `context.middyContext` per invocation; the `??=` here keeps a
// hand-rolled request that never passed through core working, and keeps the
// null prototype, which matters because keys come from user config and on a
// plain object a key of `__proto__` would set the prototype instead of an own
// property.
const contextRoot = (request) =>
	(request.context.middyContext ??= Object.create(null));

// Get-or-create the merge target for key/value data (`setToContext`), so two
// middleware sharing one contextKey merge rather than clobber.
// Only an own namespace is merged into: a nested middy's middyContext inherits
// the outer one, and writing into the inherited object would change the outer
// request's namespace. A new one inherits the outer namespace when there is
// one, so reads still see the outer values while writes stay on the inner.
export const contextNamespace = (request, contextKey) => {
	const root = contextRoot(request);
	const current = root[contextKey];
	if (
		Object.hasOwn(root, contextKey) &&
		current !== undefined &&
		current !== null
	) {
		return current;
	}
	// `null` (a cleared namespace) is an object too, and yields the same
	// null-prototype namespace.
	const namespace = Object.create(typeof current === "object" ? current : null);
	root[contextKey] = namespace;
	return namespace;
};

// Publish a single opaque value (a client, a pool, a verified payload).
export const setContextNamespace = (request, contextKey, value) => {
	contextRoot(request)[contextKey] = value;
};

// setToContext fast-path
//
// Many middlewares (kms/ssm/secrets-manager/dynamodb/s3/sts/…) follow the
// same pattern: after `processCache` resolves `value`, when `setToContext`
// is set they re-`await getInternal(fetchDataKeys, request)` solely to copy
// the same values to `request.context` under sanitized key names. On warm
// invocations every entry in `value` is already resolved, so the extra
// await + per-key regex + null-prototype-object allocation in `getInternal`
// is dead work.
//
// `buildSetToContextSpec(options)` is called once at factory time and
// returns either `null` (when `setToContext` is false) or the target
// `contextKey` plus the precomputed `[[originalKey, sanitizedKey], …]` pairs.
// Either way it rejects two `fetchData` keys that sanitize to the same name up
// front: with `setToContext` off they still collide in `request.internal`,
// where `getInternal` would throw on every invocation instead of once here.
//
// `assignSetToContext(spec, value, request)` is called once per invocation.
// Returns `undefined` synchronously when all entries are resolved (the
// common warm path), or a Promise when at least one is still pending. The
// caller should `if (p) await p` so the sync path keeps zero microtask hops.
export const buildSetToContextSpec = (options) => {
	const keys = Object.keys(options.fetchData);
	const pairs = [];
	const seen = new Set();
	for (const key of keys) {
		const sanitized = sanitizeKey(key);
		if (seen.has(sanitized)) throw duplicateSanitizedKeyError(keys, sanitized);
		seen.add(sanitized);
		pairs.push([key, sanitized]);
	}
	if (!options.setToContext) return null;
	return { contextKey: options.contextKey, pairs };
};

// Rejections are collected into the same AggregateError `getInternal` throws.
const assignSetToContextAsync = async (contextKey, pairs, value, request) => {
	const settled = await Promise.allSettled(pairs.map((pair) => value[pair[0]]));
	const errors = [];
	for (const result of settled) {
		if (result.status === "rejected") errors.push(result.reason);
	}
	if (errors.length) {
		throw new AggregateError(errors, "Failed to resolve internal values", {
			cause: { package: pkg },
		});
	}
	const ctx = contextNamespace(request, contextKey);
	for (let i = 0; i < pairs.length; i++) {
		ctx[pairs[i][1]] = settled[i].value;
	}
};

export const assignSetToContext = ({ contextKey, pairs }, value, request) => {
	for (let i = 0; i < pairs.length; i++) {
		const v = value[pairs[i][0]];
		if (typeof v?.then === "function") {
			// Cold path: at least one value still pending. Awaited straight from
			// `value`, like the warm path reads it: a fetchData key such as
			// `db.password` names one value, it is not an internal path.
			return assignSetToContextAsync(contextKey, pairs, value, request);
		}
	}
	const ctx = contextNamespace(request, contextKey);
	for (let i = 0; i < pairs.length; i++) {
		ctx[pairs[i][1]] = value[pairs[i][0]];
	}
};

// fetch Cache
// Map keyed by cacheKey; value shape: { value:{fetchKey:Promise}, expiry, refresh?, modified? }
// Map chosen over plain object so deletion is O(1), frees the key slot, and
// avoids the `delete` operator (biome's performance/noDelete rule).
// One cache for the process: `cacheMaxSize` caps it as a whole, so the caller
// storing the entry past the cap may evict another middleware's entry.
const cache = new Map();
const defaultCacheMaxSize = 128;

const validateCacheExpiry = (cacheExpiry) => {
	if (cacheExpiry === undefined || cacheExpiry === null) return;
	if (!Number.isInteger(cacheExpiry) || cacheExpiry < -1) {
		throw new Error(
			`Invalid cacheExpiry value: ${cacheExpiry}. Must be -1 (infinite), 0 (disabled), or a positive integer (ms duration or unix timestamp)`,
			{ cause: { package: pkg } },
		);
	}
};

// Attach a no-op rejection handler to any promise(s) a fetch returns. A prefetch
// (warm-up) result is stored but not awaited until a later invocation, so without
// this an early rejection would surface as an unhandledRejection. The original
// promise is left in place, so the eventual `await` still observes the error.
const silenceFetchRejections = (value) => {
	if (value instanceof Promise) {
		value.catch(() => {});
	} else if (value !== null && typeof value === "object") {
		for (const key of Object.keys(value)) {
			if (value[key] instanceof Promise) value[key].catch(() => {});
		}
	}
};

// setTimeout clamps delays above 2^31-1 ms (~24.8 days) to 1 ms and emits
// TimeoutOverflowWarning, so a refresh that far out is not scheduled at all
// (this also covers the Infinity duration of a `-1` cacheExpiry). The entry
// still expires on time, because expiry is checked on every read; it is just
// refetched on the first request after expiry instead of in the background.
const maxTimeoutDuration = 2147483647;

// Module-scope so the warm cache-hit path allocates no closure; only the
// scheduling paths (modified entry, miss) create the timer callback.
// A refresh runs outside any invocation, so the fetch gets no request, as on
// prefetch: the one that stored the entry is stale by then and keeping it
// would hold its event in memory for the entry's lifetime.
// Under `awsClientAssumeRole` there is no refresh either: without a request
// it cannot rebuild the client from the credentials sts refetched. The entry
// still expires on time and the next invocation refetches with its own.
// The refresh always refetches: a timer can fire a millisecond or so before
// Date.now reaches the expiry, and an unexpired check would then return the
// cached entry without scheduling the next refresh, ending the chain.
const scheduleRefresh = (duration, options, middlewareFetch) =>
	duration > 0 && duration <= maxTimeoutDuration && !options.awsClientAssumeRole
		? setTimeout(
				() => processCacheEntry(options, middlewareFetch, {}, true),
				duration,
			).unref()
		: undefined;

// Absolute expiry learned for `cacheKey` (see setCacheKeyExpiry), or Infinity
// when there is none.
const learnedExpiry = (options, cacheKey) =>
	options.cacheLearnedExpiry?.[cacheKey] ?? Number.POSITIVE_INFINITY;

// Stable ids for values compared by identity (functions, class instances,
// cycles), weakly held so an id never keeps its value alive.
const identityIds = new WeakMap();
let identityCount = 0;
const identityOf = (value) => {
	let id = identityIds.get(value);
	if (id === undefined) {
		// Stryker disable next-line AssignmentOperator: counting down gives equally unique ids; only their uniqueness is ever compared
		identityCount += 1;
		id = `#${identityCount}`;
		identityIds.set(value, id);
	}
	return id;
};

// Deterministic form of what a middleware fetches: keys sorted, Map and Set
// by entries (order-free), URL and Date by value, BigInt as a number. What has
// no data form (a function such as a credential provider, a class instance, a
// cycle) is compared by identity, so two different ones never pass as equal.
const serializeFetchSource = (value, seen) => {
	switch (typeof value) {
		case "string":
			return JSON.stringify(value);
		case "bigint":
			return `${value}n`;
		// A function is not a record, so it falls to the identity branch below.
		case "function":
		case "object":
			break;
		default:
			return String(value);
	}
	if (value === null) return "null";
	if (value instanceof URL) return `URL(${JSON.stringify(value.href)})`;
	if (value instanceof Date) return `Date(${value.getTime()})`;
	if (seen.has(value)) return identityOf(value);
	seen.add(value);
	const each = (item) => serializeFetchSource(item, seen);
	let out;
	if (Array.isArray(value)) {
		out = `[${value.map(each).join(",")}]`;
	} else if (value instanceof Map) {
		const pairs = [...value].map(([k, v]) => `${each(k)}:${each(v)}`);
		out = `Map{${pairs.sort().join(",")}}`;
	} else if (value instanceof Set) {
		out = `Set{${[...value].map(each).sort().join(",")}}`;
	} else if (isRecord(value)) {
		const pairs = Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${each(value[key])}`);
		out = `{${pairs.join(",")}}`;
	} else {
		out = identityOf(value);
	}
	seen.delete(value);
	return out;
};

// Fingerprints are interned to small ids, and each options object is
// fingerprinted once: a warm hit costs a WeakMap lookup, not a re-serialize
// of a config that can hold a 170KB CA bundle.
const fetchSourceIds = new Map();
const optionsFetchSourceId = new WeakMap();
const fetchSourceId = (options) => {
	let id = optionsFetchSourceId.get(options);
	if (id === undefined) {
		const fingerprint = serializeFetchSource(
			[
				options.fetchData,
				options.config,
				options.awsClientOptions,
				options.awsClientAssumeRole,
				options.AwsClient,
			],
			new Set(),
		);
		id = fetchSourceIds.get(fingerprint);
		if (id === undefined) {
			id = fetchSourceIds.size;
			fetchSourceIds.set(fingerprint, id);
		}
		optionsFetchSourceId.set(options, id);
	}
	return id;
};

// Two middleware instances sharing a cacheKey share one cache entry, so one
// fetching different data would silently be served the other's values.
// What is fetched is `fetchData`, or `config` for connection middleware
// (rds, dsql), from where `awsClientOptions` points (region, endpoint,
// credentials), as which role (`awsClientAssumeRole`) and with which client
// (`AwsClient`, by identity). Instances with identical data keep sharing the
// entry.
const assertCacheKeyOwner = (entry, options) => {
	if (entry.fetchSourceId === fetchSourceId(options)) return;
	throw new TypeError(
		`cacheKey "${options.cacheKey}" is already used by a middleware fetching different data; set a distinct cacheKey (and contextKey/internalKey) on each instance`,
		{ cause: { package: pkg, data: { cacheKey: options.cacheKey } } },
	);
};

export const processCache = (
	options,
	middlewareFetch = () => undefined,
	middlewareFetchRequest = {},
) => processCacheEntry(options, middlewareFetch, middlewareFetchRequest, false);

// `forceRefetch` skips the cache read (background refresh only).
const processCacheEntry = (
	options,
	middlewareFetch,
	middlewareFetchRequest,
	forceRefetch,
) => {
	let { cacheKey, cacheKeyExpiry, cacheExpiry, cacheMaxSize } = options;
	cacheMaxSize ??= defaultCacheMaxSize;
	cacheExpiry = cacheKeyExpiry?.[cacheKey] ?? cacheExpiry;
	validateCacheExpiry(cacheExpiry);
	const now = Date.now();
	if (cacheExpiry && !forceRefetch) {
		const cached = getCache(cacheKey);
		if (cached.expiry !== undefined) assertCacheKeyOwner(cached, options);
		// A unix-timestamp cacheExpiry is re-read on every call so a changed
		// option takes effect; a duration or -1 relies on the expiry stored with
		// the entry. Either is capped by the learned expiry, which a fetch may
		// have set after the entry was stored (once its promise resolved).
		const effectiveExpiry = Math.min(
			cacheExpiry > 86400000 ? cacheExpiry : cached.expiry,
			learnedExpiry(options, cacheKey),
		);
		const unexpired = cached.expiry && effectiveExpiry > now;

		if (unexpired) {
			if (cached.modified) {
				const value = middlewareFetch(middlewareFetchRequest, cached.value);
				silenceFetchRejections(value);
				Object.assign(cached.value, value);
				const refresh = scheduleRefresh(
					effectiveExpiry - now,
					options,
					middlewareFetch,
				);
				const entry = {
					value: cached.value,
					expiry: effectiveExpiry,
					refresh,
					middlewareFetch,
					fetchSourceId: fetchSourceId(options),
				};
				cache.set(cacheKey, entry);
				return entry;
			}
			return cached;
		}
	}
	// The expiry learned by the previous cycle is dropped before the fetch: still
	// ahead of the clock (the entry was cleared, evicted or capped by a shorter
	// cacheExpiry), it would floor whatever this cycle learns and pin every
	// later cycle to the first one's expiry.
	if (options.cacheLearnedExpiry)
		options.cacheLearnedExpiry[cacheKey] = undefined;
	const value = middlewareFetch(middlewareFetchRequest);
	silenceFetchRejections(value);
	// cacheExpiry semantics:
	//   >86400000 (24h): treated as unix timestamp (ms)
	//   >0 && <=86400000: treated as duration (ms) from now
	//   -1: infinite cache (never expires)
	//   0/undefined/null: no caching
	let expiry =
		cacheExpiry < 0
			? Number.POSITIVE_INFINITY
			: cacheExpiry > 86400000
				? cacheExpiry
				: now + (cacheExpiry ?? 0);
	if (cacheExpiry) {
		// Read after the fetch, which may have learned the expiry synchronously,
		// so the entry and its refresh fold it in from the start. One that has
		// already passed (it is what expired the previous entry) is dropped:
		// applied, it would pin the new entry to the past, so every caller in
		// the same tick would refetch and no refresh could be scheduled.
		const learned = learnedExpiry(options, cacheKey);
		if (learned > now) {
			expiry = Math.min(expiry, learned);
		} else {
			options.cacheLearnedExpiry[cacheKey] = undefined;
		}
		clearTimeout(cache.get(cacheKey)?.refresh);
		const refresh = scheduleRefresh(expiry - now, options, middlewareFetch);
		// The fetch and request are kept so an expiry learned once the fetch
		// resolves (see setCacheKeyExpiry) can reschedule this refresh.
		cache.set(cacheKey, {
			value,
			expiry,
			refresh,
			middlewareFetch,
			fetchSourceId: fetchSourceId(options),
		});
		evictCache(cacheMaxSize, cacheKey);
	}
	return { value, expiry };
};

export const catchInvalidSignatureException = (e, client, command) => {
	if (e.__type === "InvalidSignatureException") {
		return client.send(command);
	}
	throw e;
};

export const getCache = (key) => {
	return cache.get(key) ?? {};
};

// Used to remove parts of a cache
export const modifyCache = (cacheKey, value) => {
	const entry = cache.get(cacheKey);
	if (!entry) return;
	clearTimeout(entry.refresh);
	entry.value = value;
	entry.modified = true;
};

// `.catch` handler for a per-key fetch: drop the failed key from the cached
// value and flag the entry modified so the next `processCache` call refetches
// only that key, then rethrow so the current invocation still fails.
// `values` is the object the fetch returned. Given, the key is only dropped
// while the entry still holds that fetch's promise for it: a fetch that fails
// after its entry expired and a newer cycle replaced it must not evict the
// fresh value. The promise is compared rather than the object because the
// modified path merges a refetch into the entry's existing value object.
export const evictCacheOnFailure = (cacheKey, internalKey, values) => (e) => {
	const value = getCache(cacheKey).value ?? {};
	if (values === undefined || value[internalKey] === values[internalKey]) {
		value[internalKey] = undefined;
		modifyCache(cacheKey, value);
	}
	throw e;
};

// Record an absolute expiry (unix ms) learned from a fetched value (credential
// `Expiration`, token lifetime, rotation date). It lives in
// `options.cacheLearnedExpiry`, apart from the user-facing `cacheKeyExpiry`,
// and `processCache` only ever uses it to shorten the configured lifetime: it
// can neither enable caching that is disabled (0) nor extend a shorter
// `cacheExpiry`. Several keys fetched in one cycle keep the earliest expiry,
// while one left by an earlier cycle (already past) is ignored. A value that
// is not a unix timestamp (Infinity for "no expiry", NaN, a duration, a
// negative number) carries no information: it never displaces a fresh learned
// expiry and clears a stale one.
// A fetch usually learns inside its `.then`, after `processCache` stored the
// entry with the configured lifetime and scheduled the refresh for it. When
// the learned expiry shortens that entry, its refresh is moved up to match, so
// the rotation is paid in the background rather than by the first request
// after it. Nothing is scheduled when this caller has caching disabled: an
// entry found under the key then belongs to another instance.
export const setCacheKeyExpiry = (options, expiryMs) => {
	const { cacheKey } = options;
	const now = Date.now();
	const existing = options.cacheLearnedExpiry?.[cacheKey];
	const floor = existing > now ? existing : Number.POSITIVE_INFINITY;
	const learned =
		Number.isFinite(expiryMs) && expiryMs > 86400000
			? Math.floor(expiryMs)
			: Number.POSITIVE_INFINITY;
	const clamp = Math.min(learned, floor);
	options.cacheLearnedExpiry ??= {};
	options.cacheLearnedExpiry[cacheKey] =
		clamp === Number.POSITIVE_INFINITY ? undefined : clamp;
	const entry = cache.get(cacheKey);
	if (
		entry &&
		clamp < entry.expiry &&
		(options.cacheKeyExpiry?.[cacheKey] ?? options.cacheExpiry)
	) {
		clearTimeout(entry.refresh);
		entry.expiry = clamp;
		entry.refresh = scheduleRefresh(
			clamp - now,
			options,
			entry.middlewareFetch,
		);
	}
};

// The entry being inserted is never the victim: in a cache full of
// never-expiring entries it has the earliest expiry, and evicting it would
// mean its key is never cached. It only goes when it is the sole entry
// (a cacheMaxSize below 1). Ties keep the first found, so a cache of nothing
// but never-expiring entries still evicts the oldest inserted one.
const evictCache = (maxSize, insertedKey) => {
	if (cache.size <= maxSize) return;
	let oldestKey = insertedKey;
	let oldest;
	for (const [key, entry] of cache) {
		if (key === insertedKey) continue;
		if (oldest === undefined || entry.expiry < oldest.expiry) {
			oldestKey = key;
			oldest = entry;
		}
	}
	clearTimeout(cache.get(oldestKey).refresh);
	cache.delete(oldestKey);
};

export const clearCache = (inputKeys = null) => {
	let keys = inputKeys;
	keys ??= [...cache.keys()];
	if (!Array.isArray(keys)) {
		keys = [keys];
	}
	for (const cacheKey of keys) {
		clearTimeout(cache.get(cacheKey)?.refresh);
		cache.delete(cacheKey);
	}
};

// context
// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
// `tenantId` is documented under tenant isolation:
// https://docs.aws.amazon.com/lambda/latest/dg/tenant-isolation-context.html
export const lambdaContextKeys = [
	"functionName",
	"functionVersion",
	"invokedFunctionArn",
	"memoryLimitInMB",
	"awsRequestId",
	"logGroupName",
	"logStreamName",
	"identity",
	"clientContext",
	"tenantId",
];

const durableContextBrand = Symbol.for(
	"@aws/durable-execution-sdk-js/durable-context",
);
export const isExecutionModeDurable = (context) => {
	return context?.[durableContextBrand] === true;
};

export const jsonSafeParse = (text, reviver) => {
	if (typeof text !== "string") return text;
	const firstChar = text[0];
	if (firstChar !== "{" && firstChar !== "[" && firstChar !== '"') return text;
	try {
		return JSON.parse(text, reviver);
	} catch {
		return text;
	}
};

// A forbidden key only reaches the guard reviver if it is spelled in the raw
// source, so a body carrying neither spelling skips the per-key callback and
// lets JSON.parse stay on its native path (~8x). Each character matches either
// literally or as the \uXXXX escape JSON.parse decodes back to it, so no
// spelling slips past; a false positive only costs the guarded parse.
const suspectKeyRx =
	/"(?:(?:_|\\u005[Ff]){2}(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff]){2}|(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072))"\s*:/;

export const jsonParseProtectProto = (text, reviver, packageName) => {
	if (!suspectKeyRx.test(text)) {
		return JSON.parse(text, reviver);
	}
	// `function`, not an arrow: the user reviver needs the `this` the fast path
	// above binds.
	return JSON.parse(text, function (key, value) {
		if (
			key === "__proto__" ||
			(key === "constructor" && value && Object.hasOwn(value, "prototype"))
		) {
			throw new HttpError(422, {
				cause: {
					package: packageName,
					data: { reason: "Forbidden key in JSON body", key },
				},
			});
		}
		return reviver ? reviver.call(this, key, value) : value;
	});
};

// Cheap structural-JSON heuristic: returns true if `text` starts with `{`
// or `[`, indicating a JSON object/array body. Use as a Content-Type
// guard where:
//   - `{...}` / `[...]`  → `application/json`
//   - everything else    → `text/plain`
// Deliberately excludes leading `"`: a JSON string `"hi"` parses to a JS
// string, which callers consistently treat as `text/plain`. Avoids running
// a full JSON.parse just to inspect the result's type.
export const isJsonStructured = (text) => {
	if (typeof text !== "string") return false;
	const c = text.charCodeAt(0);
	return c === 123 || c === 91; // 123='{' 91='['
};

export const jsonContentTypePattern =
	/^application\/([a-z0-9.+-]+\+)?json\s*(;|$)/i;

// Decode a request body, transparently handling base64-encoded payloads.
// Takes `body` and `isBase64Encoded` directly so callers (which already
// destructure them from `request.event`) don't pay for a second destructure
// inside this helper. Returns `body` unchanged when it's nullish so callers
// can decide whether absence is an error.
export const decodeBody = (body, isBase64Encoded) => {
	if (body === undefined || body === null) return body;
	return isBase64Encoded ? Buffer.from(body, "base64").toString() : body;
};

// A handler behind an API Gateway HTTP API or a Lambda function URL may return
// its payload without a `statusCode` / `body` wrapper: "API Gateway makes the
// following assumptions if your Lambda function returns valid JSON and doesn't
// return a `statusCode`: ... `body` is the function's response."
// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
// https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html
export const isUnwrappedHttpResponse = (response) =>
	typeof response?.statusCode === "undefined" &&
	typeof response?.body === "undefined" &&
	typeof response?.headers === "undefined";

export const normalizeHttpResponse = (request) => {
	let { response } = request;
	if (typeof response === "undefined") {
		response = {};
	} else if (isUnwrappedHttpResponse(response)) {
		response = { statusCode: 200, body: response };
	}
	response.statusCode ??= 500;
	response.headers ??= {};
	request.response = response;
	return response;
};

// Segments match keys case-insensitively (HTTP field names are, RFC 9110
// section 5.1, and REST API / ALB events do not normalize them), so the tree
// holds them lower-cased. Over-redacting
// a key that differs only by case is the safe direction.
// Nodes are Maps: a segment is caller data, and a Map key can never resolve to
// an inherited member the way `node[segment]` would, so building the tree needs
// no own-property guard.
export const buildPathTree = (paths) => {
	const tree = new Map();
	for (const path of paths) {
		addPathToTree(tree, parseOmitPath(path));
	}
	return tree;
};

const omitPathStringSchema = {
	type: "string",
	pattern: /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u,
	maxLength: 1024,
};

export const omitPathsSchema = {
	type: "array",
	items: {
		oneOf: [
			omitPathStringSchema,
			{
				type: "array",
				items: omitPathStringSchema,
				minItems: 1,
				maxItems: 64,
				uniqueItems: true,
				unevaluatedItems: false,
			},
		],
	},
	maxItems: 256,
	uniqueItems: true,
	unevaluatedItems: false,
};

export const validateOmitPaths = (omitPaths) => {
	if (omitPaths === undefined) return;
	for (const path of omitPaths) {
		parseOmitPath(path);
	}
};

const parseOmitPath = (path) => {
	const segments = pathToSegments(path).map((segment) => segment.toLowerCase());
	if (segments.some((segment) => reservedPathSegments.has(segment))) {
		throw invalidPathError(
			path,
			'"__proto__", "constructor" and "prototype" segments cannot be redacted',
		);
	}
	return segments;
};

const reservedPathSegments = new Set(reservedPropertyNames);

const unsupportedStringSegmentPattern = /[[\]*]|^\d*$/;

const pathToSegments = (path) => {
	if (Array.isArray(path)) {
		if (path.length === 0) {
			throw invalidPathError(path, "an array path needs at least one segment");
		}
		for (const segment of path) {
			if (typeof segment !== "string") {
				throw invalidPathError(
					path,
					`segment ${JSON.stringify(segment)} must be a string. Use "[]" to match every element of an array, or a string to match that key literally`,
				);
			}
		}
		return path;
	}
	if (typeof path !== "string") {
		throw invalidPathError(
			path,
			"a path is a string or an array of string segments",
		);
	}
	const segments = path.split(".");
	for (const segment of segments) {
		if (segment !== "[]" && unsupportedStringSegmentPattern.test(segment)) {
			throw invalidPathError(
				path,
				`segment ${JSON.stringify(segment)} is not supported in a string path. Use ".[]." to match every element of an array, or the array form ${JSON.stringify(segments)} to match that key literally`,
			);
		}
	}
	return segments;
};

const invalidPathError = (path, reason) =>
	new TypeError(`Invalid path ${JSON.stringify(path)}: ${reason}`, {
		cause: { package: pkg, data: { path } },
	});

const addPathToTree = (tree, segments) => {
	const leaf = segments.pop();
	let node = tree;
	for (const segment of segments) {
		let child = node.get(segment);
		if (child === true) return;
		if (child === undefined) {
			child = new Map();
			node.set(segment, child);
		}
		node = child;
	}
	node.set(leaf, true);
};

const removed = Symbol("removed");

export const pathTreeOmitsString = (pathTree, segments) => {
	let node = pathTree;
	for (const segment of segments) {
		node = node?.get(segment.toLowerCase());
		if (node === true) return true;
	}
	return node?.size > 0;
};

// Returns `obj` unchanged when no `pathTree` entry applies (zero allocations
// on the cold subtree); otherwise returns a shallow clone with matched keys
// masked or removed. Only branches present in `pathTree` are walked.
export const omit = (obj, pathTree, mask) => {
	if (!pathTree || pathTree.size === 0) return obj;
	const next = omitValue(obj, pathTree, mask === undefined ? removed : mask);
	return next === removed ? undefined : next;
};

const omitValue = (value, pathTree, replacement) => {
	if (typeof value === "string") return replacement;
	if (typeof value !== "object" || value === null) return value;
	if (Array.isArray(value)) {
		const childTree = pathTree.get("[]");
		if (childTree === undefined || pathTree.size > 1) return replacement;
		return omitArray(value, childTree, replacement);
	}
	// Errors are not plain objects, so without this branch `omitObject` would
	// never run and the configured path would silently leak.
	if (value instanceof Error)
		return omitObject(errorToObject(value), pathTree, replacement);
	if (isRecord(value)) return omitObject(value, pathTree, replacement);
	if (value instanceof Map || value instanceof Set) return replacement;
	if (isOpaque(value)) return value;
	return omitInstance(value, pathTree, replacement);
};

// A class instance (the durable execution context, a request wrapper from a
// framework) is walked through a copy of its own enumerable properties, so a
// prototype getter is never read and the instance itself comes back when
// nothing under it matched. What the logger gets for it is that plain copy.
const omitInstance = (obj, pathTree, replacement) => {
	const copy = { ...obj };
	const next = omitObject(copy, pathTree, replacement);
	return next === copy ? obj : next;
};

// Built-ins stay leaves: their own properties are not data to redact (a
// Buffer's indices, a RegExp's lastIndex, a stream's internal state) and a
// spread copy would strip the state that makes them what they are.
const isOpaque = (value) => {
	if (
		value instanceof Date ||
		value instanceof RegExp ||
		value instanceof WeakMap ||
		value instanceof WeakSet ||
		value instanceof ArrayBuffer ||
		ArrayBuffer.isView(value) ||
		value instanceof ReadableStream ||
		value instanceof WritableStream
	) {
		return true;
	}
	// The remaining probes read properties. A Proxy with a strict `get` trap (a
	// framework's request wrapper) throws for one it does not carry; it is not
	// data to walk either, so it stays a leaf.
	try {
		return (
			typeof value.then === "function" ||
			value._readableState !== undefined ||
			value._writableState !== undefined
		);
	} catch {
		return true;
	}
};

// `cause`, `stack` and `AggregateError.errors` are own but non-enumerable, so a
// spread drops them, and `cause.data` is where middy puts the payload that
// triggered the error. `name` is usually inherited, hence the seed.
const errorToObject = (error) => {
	const out = { name: error.name };
	for (const key of Object.getOwnPropertyNames(error)) {
		out[key] = error[key];
	}
	return out;
};

// Counting down: `.entries()` allocates a tuple per element, and a forward
// `i < l` bound widened to `i <= l` is unobservable. `while (i--)` carries no
// bound arithmetic to widen either, so every mutation of it is observable.
const omitArray = (arr, childTree, replacement) => {
	let clone = arr;
	let i = arr.length;
	while (i--) {
		const next =
			childTree === true
				? replacement
				: omitValue(arr[i], childTree, replacement);
		if (next !== arr[i]) {
			if (clone === arr) clone = arr.slice();
			clone[i] = next;
		}
	}
	return clone === arr ? arr : clone.filter(isKeptElement);
};

const isKeptElement = (element) => element !== removed;

// Every key of a visited node is matched case-insensitively (never
// under-redact: `Authorization` next to `authorization` is folded too).
const segmentLengthsByNode = new WeakMap();
const segmentLengths = (pathTree) => {
	let lengths = segmentLengthsByNode.get(pathTree);
	if (lengths === undefined) {
		// Indexed by length: a holey-array read beats Set#has on this path.
		// Stryker disable next-line ArrayDeclaration: a seeded index 0 holds a non-`true` value, which the `!== true` filter treats as absent
		lengths = [];
		for (const segment of pathTree.keys()) {
			// `\u0130` (capital I with a dot above) is the one character whose
			// lower-case form is longer than itself, `i` followed by U+0307:
			// https://www.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
			// A key can therefore be shorter than the segment it matches, by one
			// for each such pair, and every length in between is let through.
			const shortest = segment.replaceAll("i\u0307", "\u0130").length;
			lengths.length = Math.max(lengths.length, segment.length + 1);
			lengths.fill(true, shortest, segment.length + 1);
		}
		segmentLengthsByNode.set(pathTree, lengths);
	}
	return lengths;
};

const omitObject = (obj, pathTree, replacement) => {
	const lengths = segmentLengths(pathTree);
	let clone = obj;
	let dropped;
	for (const key of Object.keys(obj)) {
		if (lengths[key.length] !== true) continue;
		const sub = pathTree.get(key) ?? pathTree.get(key.toLowerCase());
		if (sub === undefined) continue;
		let next = replacement;
		if (sub !== true) {
			next = omitValue(obj[key], sub, replacement);
			if (next === obj[key]) continue;
		}
		if (next === removed) {
			dropped ??= new Set();
			dropped.add(key);
			continue;
		}
		if (clone === obj) clone = { ...obj };
		clone[key] = next;
	}
	if (dropped === undefined) return clone;
	// Copying the survivors, not spread-then-delete: `delete` drops the object
	// into dictionary mode, making the logger's later reads ~28x slower.
	// An own "__proto__" key (JSON.parse creates one) is defined, not assigned:
	// assigning it would set the copy's prototype and hide the data from the
	// log line. Every other key keeps the plain assignment, which is faster.
	const survivors = {};
	for (const key in clone) {
		if (dropped.has(key)) continue;
		if (key === "__proto__") {
			Object.defineProperty(survivors, key, {
				value: clone[key],
				writable: true,
				enumerable: true,
				configurable: true,
			});
		} else {
			survivors[key] = clone[key];
		}
	}
	return survivors;
};

// Stricter than the schema validator's `isPlainObject`: only a plain object
// is walked in place. Null-prototype maps (built by httpHeaderNormalizer and
// event-normalizer) do count, or the keys they hold would leak into the logs
// unredacted.
// Decided by prototype rather than `value.constructor`: jsonParseProtectProto
// lets a string `constructor` key through, and reading it would mark a plain
// body as non-plain and leave everything under it unredacted.
// `omit` has already ruled out primitives and `null`, on which
// `Object.getPrototypeOf` throws or returns a wrapper prototype.
const isRecord = (value) => {
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

// import { STATUS_CODES } from "node:http"; // cost ~14ms
const STATUS_CODES = {
	100: "Continue",
	101: "Switching Protocols",
	102: "Processing",
	103: "Early Hints",
	200: "OK",
	201: "Created",
	202: "Accepted",
	203: "Non-Authoritative Information",
	204: "No Content",
	205: "Reset Content",
	206: "Partial Content",
	207: "Multi-Status",
	208: "Already Reported",
	226: "IM Used",
	300: "Multiple Choices",
	301: "Moved Permanently",
	302: "Found",
	303: "See Other",
	304: "Not Modified",
	305: "Use Proxy",
	307: "Temporary Redirect",
	308: "Permanent Redirect",
	400: "Bad Request",
	401: "Unauthorized",
	402: "Payment Required",
	403: "Forbidden",
	404: "Not Found",
	405: "Method Not Allowed",
	406: "Not Acceptable",
	407: "Proxy Authentication Required",
	408: "Request Timeout",
	409: "Conflict",
	410: "Gone",
	411: "Length Required",
	412: "Precondition Failed",
	413: "Payload Too Large",
	414: "URI Too Long",
	415: "Unsupported Media Type",
	416: "Range Not Satisfiable",
	417: "Expectation Failed",
	418: "I'm a Teapot",
	421: "Misdirected Request",
	422: "Unprocessable Entity",
	423: "Locked",
	424: "Failed Dependency",
	425: "Too Early",
	426: "Upgrade Required",
	428: "Precondition Required",
	429: "Too Many Requests",
	431: "Request Header Fields Too Large",
	451: "Unavailable For Legal Reasons",
	500: "Internal Server Error",
	501: "Not Implemented",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
	505: "HTTP Version Not Supported",
	506: "Variant Also Negotiates",
	507: "Insufficient Storage",
	508: "Loop Detected",
	510: "Not Extended",
	511: "Network Authentication Required",
};

const httpErrorNameRegexp = /[^a-zA-Z]/g;
export class HttpError extends Error {
	// The message is always the registered reason phrase for `code`. Anything
	// specific to the failure belongs in `cause.data`, which stays server-side;
	// http-error-handler only ever echoes the message to the client.
	constructor(code, options = {}) {
		super(STATUS_CODES[code], options);

		const name = (STATUS_CODES[code] ?? "Unknown").replace(
			httpErrorNameRegexp,
			"",
		);
		this.name = !name.endsWith("Error") ? `${name}Error` : name;

		this.status = this.statusCode = code; // setting `status` for backwards compatibility w/ `http-errors`
		this.expose = options.expose ?? code < 500;
	}
}

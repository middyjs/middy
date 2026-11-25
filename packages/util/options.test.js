import { ok, strictEqual, throws } from "node:assert/strict";
import { describe, test } from "node:test";
import { reservedPropertyNames, validateOptions } from "./index.js";

describe("@middy/util", () => {
	describe("validateOptions", () => {
		const schema = {
			name: "string",
			count: "number?",
			enabled: "boolean?",
			handler: "function",
			config: "object?",
			tags: "array?",
			limit: (v) => Number.isInteger(v) && v >= 1,
		};

		test("should accept valid options", () => {
			validateOptions("@middy/test", schema, {
				name: "foo",
				handler: () => {},
			});
			validateOptions("@middy/test", schema, {
				name: "foo",
				count: 1,
				enabled: true,
				handler: () => {},
				config: { a: 1 },
				tags: ["x"],
				limit: 5,
			});
		});

		test("should accept empty options when no required fields defined", () => {
			validateOptions("@middy/test", { x: "string?" }, {});
		});

		test("should default options to empty object", () => {
			validateOptions("@middy/test", { x: "string?" });
		});

		test("should throw on unknown key", () => {
			try {
				validateOptions("@middy/test", schema, {
					name: "foo",
					handler: () => {},
					typoKey: true,
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				ok(e.message.includes("typoKey"));
				strictEqual(e.cause.package, "@middy/test");
			}
		});

		test("should throw when required field missing", () => {
			try {
				validateOptions("@middy/test", schema, { handler: () => {} });
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				ok(e.message.includes("name"));
				strictEqual(e.cause.package, "@middy/test");
			}
		});

		test("should throw when field has wrong type", () => {
			try {
				validateOptions("@middy/test", schema, {
					name: 42,
					handler: () => {},
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				ok(e.message.includes("name"));
				ok(e.message.includes("string"));
			}
		});

		test("should throw when optional field has wrong type", () => {
			try {
				validateOptions("@middy/test", schema, {
					name: "foo",
					handler: () => {},
					count: "not-a-number",
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("count"));
			}
		});

		test("should throw when predicate returns false", () => {
			try {
				validateOptions("@middy/test", schema, {
					name: "foo",
					handler: () => {},
					limit: 0,
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("limit"));
			}
		});

		test("predicate should not be called for undefined", () => {
			let calls = 0;
			validateOptions(
				"@middy/test",
				{
					value: (v) => {
						calls++;
						return typeof v === "number";
					},
				},
				{},
			);
			strictEqual(calls, 0);
		});

		test("should reject array when object expected", () => {
			try {
				validateOptions("@middy/test", schema, {
					name: "foo",
					handler: () => {},
					config: [1, 2, 3],
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("config"));
				ok(e.message.includes("object"));
			}
		});

		test("should reject null when object expected", () => {
			try {
				validateOptions("@middy/test", schema, {
					name: "foo",
					handler: () => {},
					config: null,
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("config"));
			}
		});

		test("should reject NaN when number expected", () => {
			try {
				validateOptions("@middy/test", schema, {
					name: "foo",
					handler: () => {},
					count: Number.NaN,
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("count"));
			}
		});

		test("should reject non-object options", () => {
			try {
				validateOptions("@middy/test", schema, "not-an-object");
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				strictEqual(e.cause.package, "@middy/test");
			}
		});

		test("an inherited name is an unknown schema type", () => {
			for (const [schema, options, message] of [
				[
					{ x: "constructor" },
					{},
					"Unknown schema type 'constructor' for option 'x'",
				],
				[
					{ x: "toString?" },
					{},
					"Unknown schema type 'toString' for option 'x'",
				],
				[
					{
						type: "object",
						properties: { x: { type: "toString" } },
						additionalProperties: false,
					},
					{ x: 1 },
					"Unknown schema type 'toString' for option 'x'",
				],
			]) {
				throws(() => validateOptions("@middy/test", schema, options), {
					name: "TypeError",
					message,
					cause: { package: "@middy/test" },
				});
			}
		});

		test("should throw on unknown schema type", () => {
			try {
				validateOptions("@middy/test", { x: "bigint" }, { x: 1 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("bigint"));
			}
		});

		describe("nested array items", () => {
			const routesSchema = {
				routes: {
					type: "array?",
					items: {
						method: "string",
						path: "string",
						handler: "function",
					},
				},
			};

			test("accepts array whose items match the nested object schema", () => {
				validateOptions("@middy/test", routesSchema, {
					routes: [
						{ method: "GET", path: "/a", handler: () => {} },
						{ method: "POST", path: "/b", handler: () => {} },
					],
				});
			});

			test("rejects when an item is missing a required field", () => {
				try {
					validateOptions("@middy/test", routesSchema, {
						routes: [{ method: "GET", path: "/a" }],
					});
					ok(false, "expected throw");
				} catch (e) {
					ok(e instanceof TypeError);
					ok(e.message.includes("routes[0].handler"));
				}
			});

			test("rejects when an item field has the wrong type", () => {
				try {
					validateOptions("@middy/test", routesSchema, {
						routes: [{ method: 1, path: "/a", handler: () => {} }],
					});
					ok(false, "expected throw");
				} catch (e) {
					ok(e.message.includes("routes[0].method"));
					ok(e.message.includes("string"));
				}
			});

			test("rejects unknown keys inside an item", () => {
				try {
					validateOptions("@middy/test", routesSchema, {
						routes: [
							{ method: "GET", path: "/a", handler: () => {}, extra: 1 },
						],
					});
					ok(false, "expected throw");
				} catch (e) {
					ok(e.message.includes("routes[0].extra"));
				}
			});

			test("rejects non-object item when object schema expected", () => {
				try {
					validateOptions("@middy/test", routesSchema, {
						routes: ["not-an-object"],
					});
					ok(false, "expected throw");
				} catch (e) {
					ok(e.message.includes("routes[0]"));
				}
			});

			test("supports items as a type string (array of primitives)", () => {
				const schema = { tags: { type: "array", items: "string" } };
				validateOptions("@middy/test", schema, { tags: ["a", "b"] });
				try {
					validateOptions("@middy/test", schema, { tags: ["a", 2] });
					ok(false, "expected throw");
				} catch (e) {
					ok(e.message.includes("tags[1]"));
				}
			});

			test("supports items as a predicate", () => {
				const schema = {
					ports: { type: "array", items: (v) => Number.isInteger(v) && v > 0 },
				};
				validateOptions("@middy/test", schema, { ports: [80, 443] });
				try {
					validateOptions("@middy/test", schema, { ports: [80, -1] });
					ok(false, "expected throw");
				} catch (e) {
					ok(e.message.includes("ports[1]"));
				}
			});

			test("optional array may be omitted", () => {
				validateOptions("@middy/test", routesSchema, {});
			});

			test("required array (no '?') must be present", () => {
				const schema = {
					routes: { type: "array", items: "string" },
				};
				try {
					validateOptions("@middy/test", schema, {});
					ok(false, "expected throw");
				} catch (e) {
					ok(e.message.includes("routes"));
				}
			});
		});
	});

	describe("validateOptions JSON-Schema form", () => {
		const schema = {
			type: "object",
			required: ["name"],
			properties: {
				name: { type: "string" },
				count: { type: "integer", minimum: 0 },
			},
			additionalProperties: false,
		};

		test("accepts options that satisfy required + properties", () => {
			validateOptions("@middy/test", schema, { name: "foo", count: 3 });
		});

		test("throws when required field missing", () => {
			try {
				validateOptions("@middy/test", schema, { count: 3 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				ok(e.message.includes("name"));
			}
		});

		test("JSON-schema required-missing message uses an empty root path", () => {
			// The root path passed into checkRule is "", so the message is exactly
			// "Missing required option 'name'" with no path prefix.
			try {
				validateOptions("@middy/test", schema, { count: 3 });
				ok(false, "expected throw");
			} catch (e) {
				strictEqual(e.message, "Missing required option 'name'");
			}
		});

		test("null options uses the documented top-level message", () => {
			throws(() => validateOptions("@middy/test", schema, null), {
				name: "TypeError",
				message: "options must be an object",
			});
		});

		test("throws on unknown key when additionalProperties is false", () => {
			try {
				validateOptions("@middy/test", schema, { name: "foo", typo: 1 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("typo"));
			}
		});

		test("supports a $ref to a $defs class", () => {
			const fn = () => {};
			validateOptions(
				"@middy/test",
				{
					type: "object",
					required: ["handler"],
					properties: { handler: { $ref: "#/$defs/Function" } },
					additionalProperties: false,
					$defs: { Function: false },
				},
				{ handler: fn },
			);
			try {
				validateOptions(
					"@middy/test",
					{
						type: "object",
						required: ["handler"],
						properties: { handler: { $ref: "#/$defs/Function" } },
						additionalProperties: false,
						$defs: { Function: false },
					},
					{ handler: "not-a-fn" },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("handler"));
				ok(e.message.includes("Function"));
			}
		});

		test("supports oneOf for type unions", () => {
			const unionSchema = {
				type: "object",
				properties: {
					logger: {
						oneOf: [{ $ref: "#/$defs/Function" }, { type: "boolean" }],
					},
				},
				additionalProperties: false,
				$defs: { Function: false },
			};
			validateOptions("@middy/test", unionSchema, { logger: () => {} });
			validateOptions("@middy/test", unionSchema, { logger: true });
			try {
				validateOptions("@middy/test", unionSchema, { logger: 42 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("logger"));
			}
		});
	});

	describe("validateOptions const", () => {
		test("accepts value equal to const", () => {
			validateOptions(
				"@middy/test",
				{ flag: { const: false } },
				{ flag: false },
			);
		});

		test("rejects value not equal to const", () => {
			try {
				validateOptions(
					"@middy/test",
					{ flag: { const: false } },
					{ flag: true },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("flag"));
			}
		});
	});

	describe("validateOptions integer", () => {
		test("accepts an integer value", () => {
			validateOptions("@middy/test", { n: "integer" }, { n: 5 });
		});

		test("rejects a non-integer number", () => {
			try {
				validateOptions("@middy/test", { n: "integer" }, { n: 1.5 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("n"));
				ok(e.message.includes("integer"));
			}
		});

		test("rejects a non-number", () => {
			try {
				validateOptions("@middy/test", { n: "integer" }, { n: "5" });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("n"));
			}
		});
	});

	describe("validateOptions minimum", () => {
		test("accepts value at or above minimum", () => {
			validateOptions(
				"@middy/test",
				{ n: { type: "integer", minimum: 1 } },
				{ n: 1 },
			);
		});

		test("rejects value below minimum", () => {
			try {
				validateOptions(
					"@middy/test",
					{ n: { type: "integer", minimum: 1 } },
					{ n: 0 },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("n"));
				ok(e.message.includes("1"));
			}
		});
	});

	describe("validateOptions oneOf surfaces schema-construction errors", () => {
		test("an unknown type inside oneOf fails loudly with the real cause", () => {
			const schema = {
				v: {
					oneOf: [{ type: "bigint" }, { type: "string" }],
				},
			};
			try {
				validateOptions("@middy/test", schema, { v: 123 });
				ok(false, "expected throw");
			} catch (e) {
				ok(
					e.message.includes("bigint"),
					`expected construction error to surface, got: ${e.message}`,
				);
			}
		});

		test("an unrecognized sub-schema shape inside oneOf fails loudly", () => {
			const schema = {
				v: { oneOf: [{}, { type: "string" }] },
			};
			try {
				validateOptions("@middy/test", schema, { v: 123 });
				ok(false, "expected throw");
			} catch (e) {
				ok(
					e.message.includes("Invalid schema"),
					`expected invalid-schema error to surface, got: ${e.message}`,
				);
			}
		});
	});

	describe("validateOptions undefined-value short-circuits", () => {
		test("const rule allows undefined", () => {
			validateOptions("@middy/test", { flag: { const: false } }, {});
		});

		test("oneOf rule allows undefined", () => {
			validateOptions(
				"@middy/test",
				{ v: { oneOf: [{ type: "string" }, { type: "number" }] } },
				{},
			);
		});

		test("allOf rule allows undefined", () => {
			validateOptions(
				"@middy/test",
				{ v: { allOf: [{ type: "string", pattern: /^\//u }] } },
				{},
			);
		});

		test("$ref rule allows undefined", () => {
			validateOptions(
				"@middy/test",
				{
					type: "object",
					properties: {
						m: {
							type: "object",
							additionalProperties: { $ref: "#/$defs/Function" },
						},
					},
					additionalProperties: false,
					$defs: { Function: false },
				},
				{ m: { a: undefined } },
			);
		});

		test("enum with optional type allows undefined", () => {
			validateOptions(
				"@middy/test",
				{ m: { type: "string?", enum: ["a", "b"] } },
				{},
			);
		});
	});

	describe("validateOptions additionalProperties: true allows unknown", () => {
		test("accepts unknown keys when additionalProperties is true", () => {
			validateOptions(
				"@middy/test",
				{
					cfg: {
						type: "object",
						properties: { name: { type: "string" } },
						additionalProperties: true,
					},
				},
				{ cfg: { name: "foo", anything: "goes" } },
			);
		});
	});

	describe("validateOptions properties allows undefined value", () => {
		test("skips validating properties whose value is undefined", () => {
			validateOptions(
				"@middy/test",
				{
					cfg: {
						type: "object",
						properties: { name: { type: "string" } },
						additionalProperties: false,
					},
				},
				{ cfg: {} },
			);
		});
	});

	describe("validateOptions JSON-Schema form detection", () => {
		test("accepts schema using only required (no properties)", () => {
			validateOptions(
				"@middy/test",
				{ type: "object", required: [], additionalProperties: false },
				{},
			);
		});

		test("accepts schema using only additionalProperties", () => {
			validateOptions(
				"@middy/test",
				{ type: "object", additionalProperties: true },
				{ anything: 1 },
			);
		});

		test("detected via properties only: validates the value as JSON-schema", () => {
			// If not detected as JSON-schema form, the flat path would reject `x` as
			// an unknown option, so this accept proves detection via `properties`.
			validateOptions(
				"@middy/test",
				{ type: "object", properties: { x: { type: "string" } } },
				{ x: "ok" },
			);
		});

		test("detected via required only: validates the value as JSON-schema", () => {
			validateOptions(
				"@middy/test",
				{ type: "object", required: ["x"] },
				{ x: 1 },
			);
		});

		test("detected via additionalProperties only: validates the value", () => {
			validateOptions(
				"@middy/test",
				{ type: "object", additionalProperties: "number" },
				{ a: 1, b: 2 },
			);
		});

		test("requires type:'object' to be JSON-schema form (flat schema with 'properties' key)", () => {
			// A flat schema whose option happens to be named `properties` (no
			// top-level type:"object") must use the flat path, validating the
			// `properties` option value against its rule.
			validateOptions(
				"@middy/test",
				{ properties: "object?" },
				{ properties: { nested: 1 } },
			);
		});

		test("flat schema with a 'required' option key uses the flat path", () => {
			validateOptions(
				"@middy/test",
				{ required: "array?" },
				{ required: [1, 2] },
			);
		});

		test("type:'object' alone (no properties/required/additionalProperties) is NOT JSON-schema form", () => {
			// Detection requires at least one of properties/required/additionalProperties.
			// A bare {type:"object"} is a flat schema: `type` is a required option and
			// unknown options are rejected, so {foo:1} must throw.
			try {
				validateOptions("@middy/test", { type: "object" }, { foo: 1 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("foo") || e.message.includes("type"));
			}
		});

		test("non-plain-object schema carrying type/properties still uses flat dispatch", () => {
			// An array masquerading with type/properties must NOT be treated as a
			// JSON-schema object (isPlainObject guard). Under flat dispatch, the
			// array's own key `properties` is an option whose rule `{ x: ... }`
			// carries the unknown keyword `x`. If it were wrongly detected as
			// JSON-schema form, the empty options would be accepted.
			const schema = [];
			schema.type = "object";
			schema.properties = { x: { type: "string" } };
			throws(() => validateOptions("@middy/test", schema, {}), {
				name: "TypeError",
				message:
					"Unknown schema keyword 'x' in the schema for option 'properties'",
			});
		});
	});

	describe("validateOptions invalid rule fallthrough", () => {
		test("throws when rule is an unrecognized shape", () => {
			try {
				validateOptions("@middy/test", { x: 42 }, { x: 1 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("Invalid schema"));
				ok(e.message.includes("x"));
			}
		});

		test("malformed schema is re-wrapped as a packaged TypeError", () => {
			// Internally a SchemaError is thrown; validateOptions must re-wrap it as
			// a TypeError carrying cause.package so callers see the documented shape.
			try {
				validateOptions("@middy/pkgname", { x: 42 }, { x: 1 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				strictEqual(e.cause.package, "@middy/pkgname");
				strictEqual(e.message, "Invalid schema for option 'x'");
			}
		});

		test("unknown schema type is re-wrapped as a packaged TypeError", () => {
			try {
				validateOptions("@middy/pkgname", { x: "bigint" }, { x: 1 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				strictEqual(e.cause.package, "@middy/pkgname");
				ok(e.message.includes("Unknown schema type 'bigint'"));
			}
		});

		test("a validation mismatch (non-SchemaError) propagates unchanged", () => {
			// A plain field-mismatch TypeError already carries cause.package and must
			// pass through the catch untouched (not be re-wrapped or swallowed).
			try {
				validateOptions("@middy/pkgname", { name: "string" }, { name: 42 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				strictEqual(e.cause.package, "@middy/pkgname");
				strictEqual(e.message, "Option 'name' must be string");
			}
		});

		test("an error thrown by a predicate propagates unchanged", () => {
			// A predicate that throws is a bug in the caller's schema, not a
			// validation mismatch or a malformed schema; re-wrapping it would hide
			// the error's type and stack.
			const boom = new RangeError("predicate exploded");
			throws(
				() =>
					validateOptions(
						"@middy/pkgname",
						{
							x: () => {
								throw boom;
							},
						},
						{ x: 1 },
					),
				(e) => e === boom,
			);
		});
	});

	describe("validateOptions maximum", () => {
		test("accepts value at maximum boundary", () => {
			validateOptions(
				"@middy/test",
				{ n: { type: "integer", maximum: 10 } },
				{ n: 10 },
			);
		});

		test("rejects value above maximum", () => {
			try {
				validateOptions(
					"@middy/test",
					{ n: { type: "integer", maximum: 10 } },
					{ n: 11 },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("n"));
				ok(e.message.includes("10"));
			}
		});
	});

	describe("validateOptions exclusiveMinimum", () => {
		test("accepts value above exclusiveMinimum", () => {
			validateOptions(
				"@middy/test",
				{ n: { type: "integer", exclusiveMinimum: 0 } },
				{ n: 1 },
			);
		});

		test("rejects value at exclusiveMinimum boundary", () => {
			try {
				validateOptions(
					"@middy/test",
					{ n: { type: "integer", exclusiveMinimum: 0 } },
					{ n: 0 },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("n"));
				ok(e.message.includes("0"));
			}
		});
	});

	describe("validateOptions pattern", () => {
		test("accepts string matching pattern", () => {
			validateOptions(
				"@middy/test",
				{ path: { type: "string", pattern: /^\// } },
				{ path: "/foo" },
			);
		});

		test("rejects string not matching pattern", () => {
			try {
				validateOptions(
					"@middy/test",
					{ path: { type: "string", pattern: /^\// } },
					{ path: "foo" },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("path"));
			}
		});

		test("a pattern that is not a RegExp is a schema error", () => {
			throws(
				() =>
					validateOptions(
						"@middy/pkgname",
						{ path: { type: "string", pattern: "^/" } },
						{ path: "/foo" },
					),
				{
					name: "TypeError",
					message: "'pattern' must be a RegExp in the schema for option 'path'",
					cause: { package: "@middy/pkgname" },
				},
			);
		});
	});

	describe("validateOptions minLength/maxLength", () => {
		test("rejects string above maxLength", () => {
			try {
				validateOptions(
					"@middy/test",
					{ s: { type: "string", maxLength: 3 } },
					{ s: "four" },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("s"));
			}
		});

		test("rejects string below minLength", () => {
			try {
				validateOptions(
					"@middy/test",
					{ s: { type: "string", minLength: 1 } },
					{ s: "" },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("s"));
			}
		});
	});

	describe("validateOptions string keywords apply to strings only", () => {
		test("pattern, minLength and maxLength ignore a value that is not a string", () => {
			validateOptions(
				"@middy/test",
				{ n: { type: "number", pattern: /^a/u, minLength: 2, maxLength: 1 } },
				{ n: 42 },
			);
		});
	});

	describe("validateOptions enum", () => {
		test("accepts a value that matches the enum list", () => {
			validateOptions(
				"@middy/test",
				{ mode: { enum: ["always", "never", "auto"] } },
				{ mode: "auto" },
			);
		});

		test("combined with required type, missing value throws", () => {
			try {
				validateOptions(
					"@middy/test",
					{ mode: { type: "string", enum: ["always", "never"] } },
					{},
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				ok(e.message.includes("mode"));
			}
		});

		test("combined with type, wrong-typed value throws type error", () => {
			try {
				validateOptions(
					"@middy/test",
					{ mode: { type: "string", enum: ["always", "never"] } },
					{ mode: 42 },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("mode"));
				ok(e.message.includes("string"));
			}
		});

		test("omitted enum value is allowed by default", () => {
			validateOptions(
				"@middy/test",
				{ mode: { enum: ["always", "never"] } },
				{},
			);
		});

		test("rejects a value not in the enum list", () => {
			try {
				validateOptions(
					"@middy/test",
					{ mode: { enum: ["always", "never"] } },
					{ mode: "sometimes" },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				ok(e.message.includes("mode"));
			}
		});
	});

	describe("validateOptions not", () => {
		const schema = {
			map: {
				type: "object",
				propertyNames: {
					type: "string",
					maxLength: 16,
					not: { type: "string", enum: reservedPropertyNames },
				},
				additionalProperties: { type: "number" },
			},
		};

		test("accepts a value the sub-schema rejects", () => {
			validateOptions("@middy/test", schema, { map: { a: 1 } });
		});

		test("rejects a value the sub-schema accepts", () => {
			for (const key of ["__proto__", "constructor", "prototype"]) {
				throws(
					() =>
						validateOptions("@middy/test", schema, {
							map: JSON.parse(`{"${key}": 1}`),
						}),
					{
						name: "TypeError",
						message: `Invalid property name '${key}' in option 'map': Option 'map.${key}' must not match the schema in not`,
					},
				);
			}
		});

		test("the schema walk checks the sub-schema", () => {
			throws(
				() =>
					validateOptions(
						"@middy/test",
						{ k: { type: "string", not: { enum: ["a"], bogus: true } } },
						{ k: "b" },
					),
				{
					name: "TypeError",
					message:
						"Unknown schema keyword 'bogus' in the schema for option 'k'",
				},
			);
		});
	});

	describe("validateOptions allOf", () => {
		const schema = {
			path: {
				allOf: [
					{ type: "string", pattern: /^\// },
					{ type: "string", pattern: /^(\/|.*[^/])$/ },
				],
			},
		};

		test("accepts value that matches every sub-schema", () => {
			validateOptions("@middy/test", schema, { path: "/users" });
		});

		test("rejects value that fails a sub-schema", () => {
			try {
				validateOptions("@middy/test", schema, { path: "/users/" });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("path"));
			}
		});

		test("rejects value that fails the first sub-schema", () => {
			try {
				validateOptions("@middy/test", schema, { path: "no-slash" });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("path"));
			}
		});
	});

	describe("validateOptions additionalProperties", () => {
		test("accepts arbitrary keys when additionalProperties rule provided", () => {
			validateOptions(
				"@middy/test",
				{
					fetchData: {
						type: "object?",
						additionalProperties: "string",
					},
				},
				{ fetchData: { foo: "/a", bar: "/b" } },
			);
		});

		test("properties validates known keys, additionalProperties validates the rest", () => {
			const schema = {
				cfg: {
					type: "object",
					properties: { name: "string" },
					additionalProperties: "number",
				},
			};
			validateOptions("@middy/test", schema, {
				cfg: { name: "foo", a: 1, b: 2 },
			});
			try {
				validateOptions("@middy/test", schema, {
					cfg: { name: "foo", a: "not-a-number" },
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("cfg.a"));
				ok(e.message.includes("number"));
			}
		});

		test("properties enforces its own rules on known keys", () => {
			const schema = {
				cfg: {
					type: "object",
					properties: { name: "string" },
					additionalProperties: "number",
				},
			};
			try {
				validateOptions("@middy/test", schema, {
					cfg: { name: 42, a: 1 },
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("cfg.name"));
				ok(e.message.includes("string"));
			}
		});

		test("without additionalProperties, unknown keys still throw", () => {
			const schema = {
				cfg: {
					type: "object",
					properties: { name: "string" },
				},
			};
			try {
				validateOptions("@middy/test", schema, {
					cfg: { name: "foo", extra: 1 },
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("cfg.extra"));
			}
		});

		test("supports additionalProperties as predicate", () => {
			const isPath = (v) => typeof v === "string" && v.startsWith("/");
			const schema = {
				fetchData: { type: "object?", additionalProperties: isPath },
			};
			validateOptions("@middy/test", schema, {
				fetchData: { a: "/x", b: "/y" },
			});
			try {
				validateOptions("@middy/test", schema, {
					fetchData: { a: "/x", b: "no-slash" },
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("fetchData.b"));
			}
		});

		test("supports additionalProperties as nested object schema", () => {
			const schema = {
				routes: {
					type: "object",
					additionalProperties: { method: "string", handler: "function" },
				},
			};
			validateOptions("@middy/test", schema, {
				routes: {
					"/a": { method: "GET", handler: () => {} },
					"/b": { method: "POST", handler: () => {} },
				},
			});
			try {
				validateOptions("@middy/test", schema, {
					routes: { "/a": { method: "GET" } },
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("routes./a.handler"));
			}
		});

		test("supports additionalProperties as oneOf rule", () => {
			const schema = {
				headers: {
					type: "object",
					additionalProperties: {
						oneOf: [
							{ type: "string" },
							{ type: "array", items: { type: "string" } },
						],
					},
				},
			};
			validateOptions("@middy/test", schema, {
				headers: { a: "x", b: ["y", "z"] },
			});
			try {
				validateOptions("@middy/test", schema, {
					headers: { a: 42 },
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("headers.a"));
			}
		});

		test("rejects additionalProperties value of wrong type", () => {
			try {
				validateOptions(
					"@middy/test",
					{
						fetchData: {
							type: "object?",
							additionalProperties: "string",
						},
					},
					{ fetchData: { foo: "/a", bar: 42 } },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				ok(e.message.includes("fetchData.bar"));
				ok(e.message.includes("string"));
			}
		});
	});

	describe("validateOptions constraint accept paths", () => {
		test("accepts string at exact minLength boundary", () => {
			// minLength uses `<`; a string of exactly minLength must pass.
			validateOptions(
				"@middy/test",
				{ s: { type: "string", minLength: 3 } },
				{ s: "abc" },
			);
		});
		test("accepts string above minLength", () => {
			validateOptions(
				"@middy/test",
				{ s: { type: "string", minLength: 1 } },
				{ s: "x" },
			);
		});
		test("accepts string at exact maxLength boundary", () => {
			// maxLength uses `>`; a string of exactly maxLength must pass.
			validateOptions(
				"@middy/test",
				{ s: { type: "string", maxLength: 3 } },
				{ s: "abc" },
			);
		});
		test("accepts string below maxLength", () => {
			validateOptions(
				"@middy/test",
				{ s: { type: "string", maxLength: 3 } },
				{ s: "ab" },
			);
		});

		test("accepts an array with no items rule", () => {
			// type:"array" without `items`: must not attempt per-element validation.
			validateOptions(
				"@middy/test",
				{ tags: { type: "array" } },
				{ tags: [1, "two", { three: 3 }] },
			);
		});

		test("accepts an array with duplicates", () => {
			validateOptions(
				"@middy/test",
				{ tags: { type: "array" } },
				{ tags: ["a", "a"] },
			);
		});

		test("accepts an object with no required and no properties rules", () => {
			// type:"object" without `required`: must not iterate a missing list.
			validateOptions(
				"@middy/test",
				{ cfg: { type: "object", additionalProperties: true } },
				{ cfg: { a: 1 } },
			);
		});

		test("object rule with required only validates presence", () => {
			validateOptions(
				"@middy/test",
				{
					cfg: { type: "object", required: ["a"], additionalProperties: true },
				},
				{ cfg: { a: 1 } },
			);
			try {
				validateOptions(
					"@middy/test",
					{
						cfg: {
							type: "object",
							required: ["a"],
							additionalProperties: true,
						},
					},
					{ cfg: { b: 1 } },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("cfg.a"));
			}
		});

		test("object rule with only properties validates known keys and rejects unknown", () => {
			const schema = {
				cfg: { type: "object", properties: { name: { type: "string" } } },
			};
			validateOptions("@middy/test", schema, { cfg: { name: "x" } });
			try {
				validateOptions("@middy/test", schema, { cfg: { other: 1 } });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("cfg.other"));
			}
		});

		test("non-object/array rule with properties present does not run object branch", () => {
			// A string rule that happens to carry a stray `properties` key must not
			// trigger object-property iteration over the string value.
			validateOptions(
				"@middy/test",
				{ s: { type: "string", properties: { x: { type: "number" } } } },
				{ s: "hello" },
			);
		});

		test("non-array rule with items present does not run array branch", () => {
			validateOptions(
				"@middy/test",
				{ s: { type: "string", items: "number" } },
				{ s: "hello" },
			);
		});

		test("unknown key with no additionalProperties uses the 'Unknown option' message", () => {
			const schema = {
				cfg: { type: "object", properties: { name: { type: "string" } } },
			};
			try {
				validateOptions("@middy/test", schema, {
					cfg: { name: "x", extra: 1 },
				});
				ok(false, "expected throw");
			} catch (e) {
				strictEqual(e.message, "Unknown option 'cfg.extra'");
			}
		});

		test("unknown key with additionalProperties:false uses the 'Unknown option' message", () => {
			const schema = {
				cfg: {
					type: "object",
					properties: { name: { type: "string" } },
					additionalProperties: false,
				},
			};
			try {
				validateOptions("@middy/test", schema, {
					cfg: { name: "x", extra: 1 },
				});
				ok(false, "expected throw");
			} catch (e) {
				strictEqual(e.message, "Unknown option 'cfg.extra'");
			}
		});

		test("array rule carrying a stray required array does not run the required check", () => {
			// `type === "object"` guards the required-keys block; a type:"array" rule
			// that also has a `required` array must NOT validate those keys against
			// the array value.
			validateOptions(
				"@middy/test",
				{ tags: { type: "array", required: ["x"], items: "string" } },
				{ tags: ["a", "b"] },
			);
		});

		test("object rule with neither properties nor additionalProperties skips key checks", () => {
			// type:"object" with no properties and no additionalProperties: the
			// property-iteration block must not run, so arbitrary keys are allowed.
			validateOptions(
				"@middy/test",
				{ cfg: { type: "object" } },
				{ cfg: { anything: 1, more: 2 } },
			);
		});

		test("non-object rule carrying additionalProperties does not run object branch", () => {
			// A string rule with a stray additionalProperties must not iterate the
			// string's characters as object keys.
			validateOptions(
				"@middy/test",
				{ s: { type: "string", additionalProperties: "number" } },
				{ s: "hello" },
			);
		});

		test("additionalProperties:false rejects unknown key even with a valid known key", () => {
			// Distinguishes `=== false` guard: unknown key must be rejected, and
			// known key accepted.
			const schema = {
				cfg: {
					type: "object",
					properties: { name: { type: "string" } },
					additionalProperties: false,
				},
			};
			validateOptions("@middy/test", schema, { cfg: { name: "x" } });
		});
	});

	describe("validateOptions function type checker", () => {
		test("rejects a non-function value for a function field", () => {
			try {
				validateOptions(
					"@middy/test",
					{ handler: "function" },
					{ handler: "not-a-fn" },
				);
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("handler"));
				ok(e.message.includes("function"));
			}
		});
		test("accepts an actual function value for a function field", () => {
			validateOptions(
				"@middy/test",
				{ handler: "function" },
				{ handler: () => {} },
			);
		});
	});

	describe("validateOptions object type checker", () => {
		test("rejects array for an object field", () => {
			try {
				validateOptions("@middy/test", { cfg: "object" }, { cfg: [1, 2] });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("cfg"));
				ok(e.message.includes("object"));
			}
		});
		test("rejects null for an object field", () => {
			try {
				validateOptions("@middy/test", { cfg: "object" }, { cfg: null });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("cfg"));
			}
		});
		test("rejects a number for an object field", () => {
			// typeof check: a primitive number must be rejected by the object checker.
			try {
				validateOptions("@middy/test", { cfg: "object" }, { cfg: 5 });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("cfg"));
				ok(e.message.includes("object"));
			}
		});
		test("rejects a string for an object field", () => {
			try {
				validateOptions("@middy/test", { cfg: "object" }, { cfg: "str" });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("cfg"));
			}
		});
		test("accepts a plain object for an object field", () => {
			validateOptions("@middy/test", { cfg: "object" }, { cfg: { a: 1 } });
		});
	});

	describe("validateOptions error messages", () => {
		test("top-level non-object options uses the documented message", () => {
			try {
				validateOptions("@middy/test", { x: "string?" }, "nope");
				ok(false, "expected throw");
			} catch (e) {
				strictEqual(e.message, "options must be an object");
			}
		});

		test("nested non-object value uses the 'must be object' message", () => {
			const schema = {
				routes: {
					type: "array?",
					items: { method: "string" },
				},
			};
			try {
				validateOptions("@middy/test", schema, { routes: ["not-an-object"] });
				ok(false, "expected throw");
			} catch (e) {
				strictEqual(e.message, "Option 'routes[0]' must be object");
			}
		});

		test("nested null value is rejected with a packaged 'must be object' error", () => {
			// isPlainObject(null) must be false: a null nested item is rejected as a
			// TypeError with cause.package, not a raw "cannot convert null" error.
			const schema = {
				routes: {
					type: "array?",
					items: { method: "string" },
				},
			};
			try {
				validateOptions("@middy/pkgname", schema, { routes: [null] });
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				strictEqual(e.message, "Option 'routes[0]' must be object");
				strictEqual(e.cause.package, "@middy/pkgname");
			}
		});
	});

	describe("validateOptions nested rule dispatch (items/additionalProperties)", () => {
		test("items as a const rule validates each element by equality", () => {
			const schema = { flags: { type: "array", items: { const: true } } };
			validateOptions("@middy/test", schema, { flags: [true, true] });
			try {
				validateOptions("@middy/test", schema, { flags: [true, false] });
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("flags[1]"));
			}
		});

		test("additionalProperties as a $ref rule validates each value", () => {
			const schema = {
				type: "object",
				properties: {
					handlers: {
						type: "object",
						additionalProperties: { $ref: "#/$defs/Function" },
					},
				},
				additionalProperties: false,
				$defs: { Function: false },
			};
			validateOptions("@middy/test", schema, {
				handlers: { a: () => {}, b: () => {} },
			});
			try {
				validateOptions("@middy/test", schema, {
					handlers: { a: "not-a-fn" },
				});
				ok(false, "expected throw");
			} catch (e) {
				ok(e.message.includes("handlers.a"));
				ok(e.message.includes("Function"));
			}
		});
	});

	describe("validateOptions minItems/maxItems", () => {
		const schema = {
			type: "object",
			properties: {
				topics: { type: "array", items: { type: "string" }, minItems: 2 },
			},
			additionalProperties: false,
		};
		const rejects = (options, message) =>
			throws(() => validateOptions("@middy/test", schema, options), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("accepts an array at or above minItems", () => {
			validateOptions("@middy/test", schema, { topics: ["a", "b"] });
			validateOptions("@middy/test", schema, { topics: ["a", "b", "c"] });
		});

		test("rejects an array below minItems", () => {
			rejects({ topics: ["a"] }, "Option 'topics' must have >= 2 items");
			rejects({ topics: [] }, "Option 'topics' must have >= 2 items");
		});

		const maxSchema = {
			type: "object",
			properties: { topics: { type: "array", maxItems: 2 } },
			additionalProperties: false,
		};

		test("accepts an array at or below maxItems", () => {
			validateOptions("@middy/test", maxSchema, { topics: [] });
			validateOptions("@middy/test", maxSchema, { topics: ["a", "b"] });
		});

		test("rejects an array above maxItems", () => {
			throws(
				() =>
					validateOptions("@middy/test", maxSchema, {
						topics: ["a", "b", "c"],
					}),
				{
					name: "TypeError",
					message: "Option 'topics' must have <= 2 items",
					cause: { package: "@middy/test" },
				},
			);
		});
	});

	describe("validateOptions maxProperties", () => {
		const schema = {
			type: "object",
			properties: {
				dimensions: {
					type: "object",
					additionalProperties: { type: "string" },
					maxProperties: 2,
				},
			},
			additionalProperties: false,
		};

		test("accepts an object at or below maxProperties", () => {
			validateOptions("@middy/test", schema, { dimensions: {} });
			validateOptions("@middy/test", schema, {
				dimensions: { a: "1", b: "2" },
			});
		});

		test("rejects an object above maxProperties", () => {
			throws(
				() =>
					validateOptions("@middy/test", schema, {
						dimensions: { a: "1", b: "2", c: "3" },
					}),
				{
					name: "TypeError",
					message: "Option 'dimensions' must have <= 2 properties",
					cause: { package: "@middy/test" },
				},
			);
		});
	});

	describe("validateOptions checks every keyword of a rule", () => {
		const check = (rule, value) =>
			validateOptions(
				"@middy/test",
				{
					type: "object",
					properties: { a: rule },
					additionalProperties: false,
					$defs: { Array: false, Map: false },
				},
				{ a: value },
			);
		const rejects = (rule, value, message) =>
			throws(() => check(rule, value), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("enum does not hide a sibling constraint", () => {
			const rule = { type: "string", enum: ["", "a"], minLength: 1 };
			check(rule, "a");
			rejects(rule, "", "Option 'a' must have length >= 1");
			rejects(rule, "b", `Option 'a' must be one of ["","a"]`);
		});

		test("const does not hide a sibling constraint", () => {
			const rule = { const: 5, type: "integer", minimum: 10 };
			rejects(rule, 5, "Option 'a' must be >= 10");
			rejects(rule, 12, "Option 'a' must equal 5");
			rejects(rule, "5", "Option 'a' must be integer");
			check({ const: 5, type: "integer", minimum: 1 }, 5);
		});

		test("$ref does not hide a sibling constraint", () => {
			const rule = {
				$ref: "#/$defs/Array",
				type: "array",
				items: { type: "string" },
				minItems: 1,
			};
			check(rule, ["a"]);
			rejects(rule, [], "Option 'a' must have >= 1 items");
			rejects(rule, [1], "Option 'a[0]' must be string");
			rejects(
				{ $ref: "#/$defs/Map", type: "array" },
				[],
				"Option 'a' must be instanceof Map",
			);
			rejects(
				{ $ref: "#/$defs/Map", type: "array" },
				new Map(),
				"Option 'a' must be array",
			);
		});

		test("allOf does not hide a sibling constraint", () => {
			const rule = {
				type: "string",
				allOf: [{ type: "string", pattern: /^\//u }],
				maxLength: 3,
			};
			check(rule, "/ab");
			rejects(rule, "/abc", "Option 'a' must have length <= 3");
			rejects(rule, "ab", "Option 'a' must match pattern /^\\//u");
			rejects(rule, 5, "Option 'a' must be string");
		});

		test("oneOf does not hide a sibling constraint", () => {
			const rule = {
				type: "object",
				properties: { x: { type: "string" } },
				additionalProperties: false,
				oneOf: [{ type: "object" }],
			};
			check(rule, { x: "ok" });
			rejects(rule, { x: 1 }, "Option 'a.x' must be string");
			rejects(rule, { junk: true }, "Unknown option 'a.junk'");
			rejects(rule, "x", "Option 'a' must be object");
			rejects(
				{ type: "object", oneOf: [{ type: "object", required: ["x"] }] },
				{},
				"Option 'a' must match exactly one schema in oneOf",
			);
		});

		const either = (...types) => types.map((type) => ({ type }));

		test("a rule without type accepts null and skips every kind-specific keyword", () => {
			check({ const: null }, null);
			check({ enum: [null, "a"] }, null);
			check(
				{
					enum: [null],
					minimum: 1,
					minItems: 1,
					maxProperties: 0,
					required: ["x"],
				},
				null,
			);
		});

		test("number keywords apply to numbers only", () => {
			const rule = {
				oneOf: either("string", "number"),
				minimum: 2,
				maximum: 0,
				exclusiveMinimum: 1,
			};
			check(rule, "1");
			rejects(rule, 1, "Option 'a' must be >= 2");
		});

		test("array keywords apply to arrays without a type", () => {
			const rule = {
				oneOf: either("string", "array"),
				minItems: 2,
				maxItems: 3,
				items: { type: "string" },
			};
			check(rule, "x");
			check(rule, ["a", "b"]);
			rejects(rule, ["a"], "Option 'a' must have >= 2 items");
			rejects(rule, ["a", "b", "c", "d"], "Option 'a' must have <= 3 items");
			rejects(rule, ["a", 1], "Option 'a[1]' must be string");
		});

		test("object keywords apply to objects without a type", () => {
			const rule = {
				oneOf: either("string", "object"),
				required: ["x"],
				properties: { x: { type: "string" } },
				additionalProperties: false,
				maxProperties: 1,
			};
			check(rule, "x");
			check(rule, { x: "ok" });
			rejects(rule, {}, "Missing required option 'a.x'");
			rejects(rule, { x: 1 }, "Option 'a.x' must be string");
			rejects(rule, { x: "ok", y: 1 }, "Option 'a' must have <= 1 properties");
			rejects(
				{ ...rule, maxProperties: 2 },
				{ x: "ok", y: 1 },
				"Unknown option 'a.y'",
			);
		});

		test("a string keyword applies to strings only without a type", () => {
			const rule = { oneOf: either("string", "number"), minLength: 2 };
			check(rule, "ab");
			check(rule, 5);
			rejects(rule, "a", "Option 'a' must have length >= 2");
		});
	});

	describe("validateOptions unknown schema keywords", () => {
		const jsonSchema = (properties, extra) => ({
			type: "object",
			properties,
			additionalProperties: false,
			...extra,
		});
		const rejectsSchema = (schema, options, message) =>
			throws(() => validateOptions("@middy/test", schema, options), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("throws for a keyword it does not implement, naming it and the option", () => {
			for (const [keyword, rule, value] of [
				["minimun", { type: "integer", minimun: 0 }, -5],
				["multipleOf", { type: "integer", multipleOf: 2 }, 3],
				["anyOf", { type: "string", anyOf: [{ type: "string" }] }, "x"],
				["description", { type: "string", description: "A name" }, "x"],
			]) {
				rejectsSchema(
					jsonSchema({ a: rule }),
					{ a: value },
					`Unknown schema keyword '${keyword}' in the schema for option 'a'`,
				);
			}
		});

		test("instanceof is not a keyword, with or without a sibling rule marker", () => {
			const message =
				"Unknown schema keyword 'instanceof' in the schema for option 'a'";
			for (const rule of [
				{ type: "object", instanceof: "Function" },
				{ instanceof: "Function" },
				{ oneOf: [{ instanceof: "Function" }, { type: "boolean" }] },
				{ allOf: [{ instanceof: "Function" }] },
				{ type: "object", propertyNames: { instanceof: "String" } },
			]) {
				rejectsSchema(jsonSchema({ a: rule }), {}, message);
			}
		});

		test("throws when the option that carries the keyword is not passed", () => {
			const schema = jsonSchema({
				a: { type: "integer", minimun: 0 },
				b: { type: "string" },
			});
			const message =
				"Unknown schema keyword 'minimun' in the schema for option 'a'";
			rejectsSchema(schema, {}, message);
			rejectsSchema(schema, undefined, message);
			rejectsSchema(schema, { b: "x" }, message);
			rejectsSchema(schema, { b: 1 }, message);
			rejectsSchema(schema, null, message);
		});

		test("names where the keyword sits, however deep", () => {
			const bad = { type: "string", bogus: true };
			for (const [schema, where] of [
				[jsonSchema({}, { bogus: true }), "options"],
				[jsonSchema({ a: { type: "array", items: bad } }), "option 'a[]'"],
				[
					jsonSchema({ a: { type: "array", items: { name: bad } } }),
					"option 'a[].name'",
				],
				[
					jsonSchema({ a: { type: "object", additionalProperties: bad } }),
					"option 'a.*'",
				],
				[
					{ type: "object", additionalProperties: { name: bad } },
					"option '*.name'",
				],
				[
					jsonSchema({ a: jsonSchema({ b: jsonSchema({ c: bad }) }) }),
					"option 'a.b.c'",
				],
				[jsonSchema({ a: { oneOf: [{ type: "number" }, bad] } }), "option 'a'"],
				[jsonSchema({ a: { allOf: [{ type: "string" }, bad] } }), "option 'a'"],
				[{ a: "string?", b: bad }, "option 'b'"],
				[{ a: { type: "array?", items: { name: bad } } }, "option 'a[].name'"],
			]) {
				rejectsSchema(
					schema,
					{},
					`Unknown schema keyword 'bogus' in the schema for ${where}`,
				);
			}
		});

		test("reads the keys of properties and of a flat schema as option names", () => {
			validateOptions(
				"@middy/test",
				jsonSchema({
					type: "string",
					const: { type: "string" },
					bogus: { type: "string" },
				}),
				{ type: "a", const: "b", bogus: "c" },
			);
			validateOptions(
				"@middy/test",
				{ type: "string", bogus: "string?", enum: "array?" },
				{ type: "a", enum: [] },
			);
		});

		test("walks a schema that refers to itself", () => {
			const node = {
				type: "object",
				properties: { name: { type: "string" } },
				additionalProperties: false,
			};
			node.properties.children = { type: "array", items: node };
			validateOptions("@middy/test", node, {
				name: "root",
				children: [{ name: "leaf", children: [] }],
			});
			node.properties.children.bogus = true;
			rejectsSchema(
				node,
				{},
				"Unknown schema keyword 'bogus' in the schema for option 'children'",
			);
		});

		test("accepts the examples annotation and ignores it", () => {
			const schema = jsonSchema(
				{
					a: { type: "string", examples: ["x"] },
					b: { oneOf: [{ type: "number", examples: [1] }], examples: [2] },
				},
				{ examples: [{ a: "x" }] },
			);
			validateOptions("@middy/test", schema, { a: "not-an-example", b: 3 });
		});

		test("leaves a rule that is not an object to its own check", () => {
			validateOptions(
				"@middy/test",
				{
					a: "string?",
					b: (v) => v > 0,
					c: { type: "array?", items: "string" },
				},
				{ b: 1, c: ["x"] },
			);
			rejectsSchema({ a: 42 }, { a: 1 }, "Invalid schema for option 'a'");
			rejectsSchema({ a: null }, { a: 1 }, "Invalid schema for option 'a'");
		});
	});

	describe("validateOptions reads own properties only", () => {
		const rejects = (schema, options, message) =>
			throws(() => validateOptions("@middy/test", schema, options), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("required is not satisfied by an inherited property", () => {
			const schema = {
				type: "object",
				required: ["constructor", "toString", "__proto__"],
				additionalProperties: true,
			};
			rejects(schema, {}, "Missing required option 'constructor'");
			rejects(schema, { constructor: 1 }, "Missing required option 'toString'");
			rejects(
				schema,
				{ constructor: 1, toString: 2 },
				"Missing required option '__proto__'",
			);
			validateOptions(
				"@middy/test",
				schema,
				JSON.parse('{"constructor":1,"toString":2,"__proto__":3}'),
			);
		});

		test("properties does not validate an inherited property", () => {
			const schema = {
				type: "object",
				properties: {
					constructor: { type: "string" },
					toString: { type: "string" },
				},
				additionalProperties: false,
			};
			validateOptions("@middy/test", schema, {});
			validateOptions("@middy/test", schema, { constructor: "own" });
			rejects(schema, { toString: 1 }, "Option 'toString' must be string");
		});

		test("a flat schema does not read an inherited property", () => {
			rejects(
				{ toString: "function" },
				{},
				"Missing required option 'toString' (function)",
			);
			validateOptions("@middy/test", { constructor: "string?" }, {});
			validateOptions(
				"@middy/test",
				{ toString: "function" },
				{ toString: () => "own" },
			);
		});
	});
	describe("validateOptions exclusiveMaximum", () => {
		const schema = {
			type: "object",
			properties: { n: { type: "number", exclusiveMaximum: 5 } },
			additionalProperties: false,
		};

		test("accepts a value below exclusiveMaximum", () => {
			validateOptions("@middy/test", schema, { n: 4.5 });
		});

		test("rejects a value at exclusiveMaximum", () => {
			throws(() => validateOptions("@middy/test", schema, { n: 5 }), {
				name: "TypeError",
				message: "Option 'n' must be < 5",
				cause: { package: "@middy/test" },
			});
		});
	});

	describe("validateOptions uniqueItems", () => {
		const check = (list, uniqueItems = true) =>
			validateOptions(
				"@middy/test",
				{
					type: "object",
					properties: { list: { type: "array", uniqueItems } },
					additionalProperties: false,
				},
				{ list },
			);
		const rejects = (list, index) =>
			throws(() => check(list), {
				name: "TypeError",
				message: `Duplicate item at 'list[${index}]'`,
				cause: { package: "@middy/test" },
			});
		class Point {
			constructor(x) {
				this.x = x;
			}
		}

		test("rejects the first item equal to an earlier one", () => {
			check(["a", "b", "c"]);
			rejects(["a", "b", "a", "b"], 2);
			rejects([0, -0], 1);
			rejects([null, null], 1);
			rejects([undefined, undefined], 1);
		});

		test("allows duplicates when uniqueItems is false", () => {
			check(["a", "a"], false);
		});

		test("compares arrays item by item", () => {
			rejects(
				[
					[1, [2]],
					[1, [2]],
				],
				1,
			);
			for (const list of [
				[
					[1, 2],
					[2, 1],
				],
				[[1, 2], [1]],
				[[1], [1, 2]],
				[[1], []],
				[
					[1, 2],
					[1, 3],
				],
			]) {
				check(list);
			}
		});

		test("compares plain objects by their keys and values, ignoring key order", () => {
			rejects(
				[
					{ a: 1, b: [2] },
					{ b: [2], a: 1 },
				],
				1,
			);
			rejects([Object.assign(Object.create(null), { a: 1 }), { a: 1 }], 1);
			for (const list of [
				[{ a: 1, b: 2 }, { a: 1 }],
				[{ a: 1 }, { a: 1, b: 2 }],
				[
					{ a: 1, b: 2 },
					{ a: 1, b: 3 },
				],
				[{ a: undefined }, { b: undefined }],
			]) {
				check(list);
			}
		});

		test("an empty array, an empty object and an empty string are distinct", () => {
			check([[], {}, ""]);
			check(["", {}, []]);
		});

		test("compares functions and class instances by identity", () => {
			const fn = () => 1;
			const point = new Point(1);
			rejects([fn, fn], 1);
			rejects([point, point], 1);
			check([() => 1, () => 1]);
			check([new Point(1), new Point(1)]);
			check([new Point(1), { x: 1 }]);
			check([{ x: 1 }, new Point(1)]);
		});
	});

	describe("validateOptions unevaluatedItems and unevaluatedProperties", () => {
		const rejectsSchema = (schema, message) =>
			throws(() => validateOptions("@middy/test", schema, {}), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("accepts unevaluatedItems: false next to items and still checks items", () => {
			const schema = {
				type: "object",
				properties: {
					list: {
						type: "array",
						items: { type: "string" },
						unevaluatedItems: false,
					},
				},
				additionalProperties: false,
			};
			validateOptions("@middy/test", schema, { list: ["a"] });
			throws(() => validateOptions("@middy/test", schema, { list: [1] }), {
				message: "Option 'list[0]' must be string",
			});
		});

		test("rejects any other use of unevaluatedItems", () => {
			for (const list of [
				{ type: "array", unevaluatedItems: false },
				{ type: "array", items: { type: "string" }, unevaluatedItems: true },
				{
					type: "array",
					items: { type: "string" },
					unevaluatedItems: { type: "string" },
				},
			]) {
				rejectsSchema(
					{
						type: "object",
						properties: { list },
						additionalProperties: false,
					},
					"'unevaluatedItems' must be false next to 'items' in the schema for option 'list'",
				);
			}
		});

		test("accepts unevaluatedProperties: false next to additionalProperties and still checks them", () => {
			const schema = {
				type: "object",
				properties: {
					map: {
						type: "object",
						additionalProperties: { type: "string" },
						unevaluatedProperties: false,
					},
				},
				additionalProperties: false,
				unevaluatedProperties: false,
			};
			validateOptions("@middy/test", schema, { map: { a: "b" } });
			throws(() => validateOptions("@middy/test", schema, { map: { a: 1 } }), {
				message: "Option 'map.a' must be string",
			});
			throws(() => validateOptions("@middy/test", schema, { other: 1 }), {
				message: "Unknown option 'other'",
			});
		});

		test("rejects any other use of unevaluatedProperties", () => {
			for (const [schema, where] of [
				[
					{
						type: "object",
						properties: {},
						unevaluatedProperties: false,
					},
					"options",
				],
				[
					{
						type: "object",
						properties: {},
						additionalProperties: false,
						unevaluatedProperties: true,
					},
					"options",
				],
				[
					{
						type: "object",
						properties: {
							map: {
								type: "object",
								additionalProperties: { type: "string" },
								unevaluatedProperties: { type: "string" },
							},
						},
						additionalProperties: false,
					},
					"option 'map'",
				],
			]) {
				rejectsSchema(
					schema,
					`'unevaluatedProperties' must be false next to 'additionalProperties' in the schema for ${where}`,
				);
			}
		});
	});

	describe("validateOptions propertyNames", () => {
		const names = { type: "string", pattern: /^[a-z]+$/u, maxLength: 3 };
		const rejects = (schema, options, message) =>
			throws(() => validateOptions("@middy/test", schema, options), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("checks every key of an object value, naming the key", () => {
			const schema = {
				type: "object",
				properties: {
					map: {
						type: "object",
						additionalProperties: { type: "string" },
						propertyNames: names,
					},
				},
				additionalProperties: false,
			};
			validateOptions("@middy/test", schema, { map: { ab: "x", c: "y" } });
			rejects(
				schema,
				{ map: { ab: "x", "B c": "y" } },
				"Invalid property name 'B c' in option 'map': Option 'map.B c' must match pattern /^[a-z]+$/u",
			);
			rejects(
				schema,
				{ map: { abcd: "x" } },
				"Invalid property name 'abcd' in option 'map': Option 'map.abcd' must have length <= 3",
			);
		});

		test("checks keys listed in properties and keys of an open object", () => {
			rejects(
				{
					type: "object",
					properties: { Ab: { type: "string" } },
					additionalProperties: false,
					propertyNames: names,
				},
				{ Ab: "x" },
				"Invalid property name 'Ab' in options: Option 'Ab' must match pattern /^[a-z]+$/u",
			);
			const open = {
				type: "object",
				properties: { map: { type: "object", propertyNames: names } },
				additionalProperties: false,
			};
			validateOptions("@middy/test", open, { map: { ab: 1 } });
			rejects(
				open,
				{ map: { AB: 1 } },
				"Invalid property name 'AB' in option 'map': Option 'map.AB' must match pattern /^[a-z]+$/u",
			);
		});

		test("walks the propertyNames rule for unknown keywords", () => {
			rejects(
				{
					type: "object",
					properties: {
						map: {
							type: "object",
							propertyNames: { type: "string", bogus: true },
						},
					},
					additionalProperties: false,
				},
				{},
				"Unknown schema keyword 'bogus' in the schema for option 'map'",
			);
		});
	});

	describe("validateOptions root keywords", () => {
		const draft = "https://json-schema.org/draft/2020-12/schema";
		const root = (extra, properties = { a: { type: "string" } }) => ({
			$schema: draft,
			$id: "urn:middy:test:options",
			type: "object",
			properties,
			required: [],
			additionalProperties: false,
			unevaluatedProperties: false,
			...extra,
		});
		const rejectsSchema = (schema, message) =>
			throws(() => validateOptions("@middy/test", schema, {}), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("accepts $schema and $id at the root and validates the options", () => {
			validateOptions("@middy/test", root(), { a: "x" });
			throws(() => validateOptions("@middy/test", root(), { b: "x" }), {
				message: "Unknown option 'b'",
			});
		});

		test("$schema must be the 2020-12 dialect", () => {
			for (const $schema of [
				"http://json-schema.org/draft-07/schema#",
				`${draft}#`,
				"",
				null,
			]) {
				rejectsSchema(root({ $schema }), `'$schema' must be '${draft}'`);
			}
		});

		test("$id must be a non-empty string", () => {
			for (const $id of [1, null, {}, ""]) {
				rejectsSchema(root({ $id }), "'$id' must be a non-empty string");
			}
		});

		test("$schema, $id and $defs are root only", () => {
			for (const [keyword, value] of [
				["$schema", draft],
				["$id", "urn:middy:test:a"],
				["$defs", {}],
			]) {
				rejectsSchema(
					root({}, { a: { type: "string", [keyword]: value } }),
					`Unknown schema keyword '${keyword}' in the schema for option 'a'`,
				);
				rejectsSchema(
					root({ allOf: [{ type: "object", [keyword]: value }] }),
					`Unknown schema keyword '${keyword}' in the schema for options`,
				);
			}
		});
	});

	describe("validateOptions $defs and $ref", () => {
		const fn = () => {};
		const root = (properties, $defs = { Function: false, RegExp: false }) => ({
			$schema: "https://json-schema.org/draft/2020-12/schema",
			type: "object",
			properties,
			additionalProperties: false,
			$defs,
		});
		const rejects = (schema, options, message) =>
			throws(() => validateOptions("@middy/test", schema, options), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("a $ref to a false $defs entry checks instanceof the global class of that name", () => {
			const schema = root({ handler: { $ref: "#/$defs/Function" } });
			validateOptions("@middy/test", schema, { handler: fn });
			validateOptions("@middy/test", schema, {});
			rejects(
				schema,
				{ handler: "fn" },
				"Option 'handler' must be instanceof Function",
			);
		});

		test("$ref works in items, oneOf, allOf and additionalProperties", () => {
			const schema = root({
				routes: {
					type: "array",
					items: {
						type: "object",
						properties: { handler: { $ref: "#/$defs/Function" } },
						additionalProperties: false,
					},
				},
				patterns: { type: "array", items: { $ref: "#/$defs/RegExp" } },
				logger: {
					oneOf: [
						{ $ref: "#/$defs/Function" },
						{ type: "boolean", const: false },
					],
				},
				hook: { allOf: [{ $ref: "#/$defs/Function" }] },
				handlers: {
					type: "object",
					additionalProperties: { $ref: "#/$defs/Function" },
				},
			});
			validateOptions("@middy/test", schema, {
				routes: [{ handler: fn }],
				patterns: [/a/],
				logger: fn,
				hook: fn,
				handlers: { a: fn },
			});
			validateOptions("@middy/test", schema, { logger: false });
			rejects(
				schema,
				{ routes: [{ handler: 1 }] },
				"Option 'routes[0].handler' must be instanceof Function",
			);
			rejects(
				schema,
				{ patterns: ["a"] },
				"Option 'patterns[0]' must be instanceof RegExp",
			);
			rejects(
				schema,
				{ logger: true },
				"Option 'logger' must match exactly one schema in oneOf",
			);
			rejects(schema, { hook: 1 }, "Option 'hook' must be instanceof Function");
			rejects(
				schema,
				{ handlers: { a: 1 } },
				"Option 'handlers.a' must be instanceof Function",
			);
		});

		test("every $defs entry is false and names a global class", () => {
			for (const def of [true, {}, { type: "string" }]) {
				rejects(
					root({}, { Function: def }),
					{},
					"'$defs' entry 'Function' must be false",
				);
			}
			for (const name of ["NotARealGlobalClass", "JSON"]) {
				rejects(
					root({}, { [name]: false }),
					{},
					`Unknown '$defs' class '${name}'`,
				);
			}
		});

		test("$ref must be #/$defs/<name> for an entry in $defs", () => {
			for (const $ref of [
				"#/$defs/Date",
				"#/definitions/Function",
				"Function",
				"#/$defs/Function/x",
				"https://example.com/schema#/$defs/Function",
				5,
			]) {
				rejects(
					root({ a: { $ref } }),
					{},
					`Unknown '$ref' '${$ref}' in the schema for option 'a'`,
				);
			}
			rejects(
				{ a: { $ref: "#/$defs/Function" } },
				{},
				"Unknown '$ref' '#/$defs/Function' in the schema for option 'a'",
			);
		});
	});
	describe("validateOptions pattern is a RegExp", () => {
		const schema = {
			type: "object",
			properties: { name: { type: "string", pattern: /^[\p{L} ]+$/u } },
			additionalProperties: false,
		};

		test("matches Unicode property escapes", () => {
			validateOptions("@middy/test", schema, { name: "Grüße" });
			validateOptions("@middy/test", schema, { name: "héllo wörld" });
			throws(() => validateOptions("@middy/test", schema, { name: "p{L}1" }), {
				name: "TypeError",
				message: "Option 'name' must match pattern /^[\\p{L} ]+$/u",
			});
		});

		test("a RegExp pattern is used as is, keeping its own flags", () => {
			const caseless = { name: { type: "string", pattern: /^abc$/i } };
			validateOptions("@middy/test", caseless, { name: "ABC" });
			throws(() => validateOptions("@middy/test", caseless, { name: "abd" }), {
				message: "Option 'name' must match pattern /^abc$/i",
			});
		});
	});
	describe("validateOptions null type and type arrays", () => {
		const schema = (rule) => ({
			type: "object",
			properties: { v: rule },
			additionalProperties: false,
		});
		const rejects = (schemaValue, options, message) =>
			throws(() => validateOptions("@middy/test", schemaValue, options), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("the null type accepts null only", () => {
			validateOptions("@middy/test", schema({ type: "null" }), { v: null });
			rejects(schema({ type: "null" }), { v: 0 }, "Option 'v' must be null");
			validateOptions("@middy/test", { v: "null?" }, {});
		});

		test("a type array accepts a value of any listed type", () => {
			const either = schema({ type: ["string", "null"] });
			validateOptions("@middy/test", either, { v: "x" });
			validateOptions("@middy/test", either, { v: null });
			validateOptions("@middy/test", either, {});
			rejects(either, { v: 1 }, "Option 'v' must be string or null");
		});

		test("a type array requires a value like a string type without '?'", () => {
			rejects(
				{ v: { type: ["string", "null"] } },
				{},
				"Missing required option 'v' (string or null)",
			);
		});

		test("a type array is a rule", () => {
			const list = schema({
				type: "array",
				items: { type: ["string", "number"] },
			});
			validateOptions("@middy/test", list, { v: [1, "a"] });
			rejects(list, { v: [true] }, "Option 'v[0]' must be string or number");
		});

		test("a type array must list distinct known type names", () => {
			for (const [type, message] of [
				[[], "'type' must list at least one type in the schema for option 'v'"],
				[
					["string", "string"],
					"Duplicate schema type 'string' in the schema for option 'v'",
				],
				[
					["string", "bigint"],
					"Unknown schema type 'bigint' in the schema for option 'v'",
				],
				[
					["string?"],
					"Unknown schema type 'string?' in the schema for option 'v'",
				],
				[
					["toString"],
					"Unknown schema type 'toString' in the schema for option 'v'",
				],
			]) {
				rejects(schema({ type }), {}, message);
			}
		});

		test("string or array of strings, with keywords for each type", () => {
			const header = { type: "string", maxLength: 8, pattern: /^[a-z]+$/u };
			const defaultHeaders = schema({
				...header,
				type: ["string", "array"],
				items: header,
				maxItems: 2,
				uniqueItems: true,
				unevaluatedItems: false,
			});
			for (const v of ["abc", ["abc", "def"], []]) {
				validateOptions("@middy/test", defaultHeaders, { v });
			}
			for (const [v, message] of [
				[1, "Option 'v' must be string or array"],
				["ABC", "Option 'v' must match pattern /^[a-z]+$/u"],
				["abcdefghi", "Option 'v' must have length <= 8"],
				[["ABC"], "Option 'v[0]' must match pattern /^[a-z]+$/u"],
				[["a", "a"], "Duplicate item at 'v[1]'"],
				[["a", "b", "c"], "Option 'v' must have <= 2 items"],
			]) {
				rejects(defaultHeaders, { v }, message);
			}
		});

		test("string, number or boolean, with keywords for each type", () => {
			const expectedClaims = schema({
				type: ["string", "number", "boolean"],
				minimum: 0,
				maximum: 100,
				maxLength: 8,
				pattern: /^[a-z]+$/u,
			});
			for (const v of ["abc", 0, 100, true, false]) {
				validateOptions("@middy/test", expectedClaims, { v });
			}
			for (const [v, message] of [
				["ABC", "Option 'v' must match pattern /^[a-z]+$/u"],
				["abcdefghi", "Option 'v' must have length <= 8"],
				[101, "Option 'v' must be <= 100"],
				[-1, "Option 'v' must be >= 0"],
				[null, "Option 'v' must be string or number or boolean"],
				[[], "Option 'v' must be string or number or boolean"],
				[{}, "Option 'v' must be string or number or boolean"],
			]) {
				rejects(expectedClaims, { v }, message);
			}
		});
	});
	describe("validateOptions patternProperties", () => {
		const fn = () => {};
		const tag = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8}){0,127}$/u;
		const schema = (m, extra) => ({
			type: "object",
			properties: { m },
			additionalProperties: false,
			...extra,
		});
		const rejects = (schemaValue, options, message) =>
			throws(() => validateOptions("@middy/test", schemaValue, options), {
				name: "TypeError",
				message,
				cause: { package: "@middy/test" },
			});

		test("a map of language tags to functions", () => {
			const languages = schema(
				{
					type: "object",
					patternProperties: { [tag.source]: { $ref: "#/$defs/Function" } },
					propertyNames: { type: "string", maxLength: 1024, pattern: tag },
					maxProperties: 1024,
					additionalProperties: false,
					required: [],
					unevaluatedProperties: false,
				},
				{ $defs: { Function: false } },
			);
			validateOptions("@middy/test", languages, {
				m: { en: fn, "fr-CA": fn },
			});
			rejects(
				languages,
				{ m: { en: "fn" } },
				"Option 'm.en' must be instanceof Function",
			);
			rejects(
				languages,
				{ m: { "not a tag": fn } },
				`Invalid property name 'not a tag' in option 'm': Option 'm.not a tag' must match pattern ${tag}`,
			);
		});

		test("every matching pattern validates the value", () => {
			const both = schema({
				type: "object",
				patternProperties: {
					"^a": { type: "string" },
					b$: { type: "string", maxLength: 2 },
				},
			});
			validateOptions("@middy/test", both, { m: { a: "abc", ab: "ab" } });
			rejects(both, { m: { ab: 1 } }, "Option 'm.ab' must be string");
			rejects(
				both,
				{ m: { ab: "abc" } },
				"Option 'm.ab' must have length <= 2",
			);
		});

		test("a pattern is an unanchored Unicode regular expression", () => {
			const letters = schema({
				type: "object",
				patternProperties: {
					"\\p{L}": { type: "string" },
					x: { type: "number" },
				},
			});
			validateOptions("@middy/test", letters, { m: { Grüße: "s" } });
			rejects(letters, { m: { "1x2": "s" } }, "Option 'm.1x2' must be number");
		});

		test("additionalProperties applies only to keys no property or pattern matches", () => {
			const mixed = schema({
				type: "object",
				properties: { p: { type: "boolean" } },
				patternProperties: { "^x-": { type: "string" } },
				additionalProperties: { type: "number" },
			});
			validateOptions("@middy/test", mixed, {
				m: { p: true, "x-a": "s", b: 1 },
			});
			rejects(mixed, { m: { b: "s" } }, "Option 'm.b' must be number");
			rejects(mixed, { m: { "x-a": 1 } }, "Option 'm.x-a' must be string");
			rejects(mixed, { m: { p: 1 } }, "Option 'm.p' must be boolean");
		});

		test("a pattern also applies to a key listed in properties", () => {
			rejects(
				schema({
					type: "object",
					properties: { "x-a": { type: "string" } },
					patternProperties: { "^x-": { type: "string", maxLength: 1 } },
				}),
				{ m: { "x-a": "ab" } },
				"Option 'm.x-a' must have length <= 1",
			);
		});

		test("a pattern's rule may be a flat schema", () => {
			const flat = schema({
				type: "object",
				patternProperties: { "^x-": { name: "string" } },
			});
			validateOptions("@middy/test", flat, { m: { "x-a": { name: "n" } } });
			rejects(
				flat,
				{ m: { "x-a": { name: 1 } } },
				"Option 'm.x-a.name' must be string",
			);
		});

		test("without additionalProperties, a key no pattern matches is unknown", () => {
			rejects(
				schema({
					type: "object",
					patternProperties: { "^x-": { type: "string" } },
				}),
				{ m: { y: "s" } },
				"Unknown option 'm.y'",
			);
		});

		test("an invalid pattern is a schema error", () => {
			for (const pattern of ["[", "\\-"]) {
				rejects(
					schema({
						type: "object",
						patternProperties: { [pattern]: { type: "string" } },
					}),
					{},
					`Invalid pattern '${pattern}' in patternProperties in the schema for option 'm'`,
				);
			}
		});

		test("the schema walk checks the rule of each pattern", () => {
			rejects(
				schema(
					{
						type: "object",
						patternProperties: { "^x-": { $ref: "#/$defs/Nope" } },
					},
					{ $defs: { Function: false } },
				),
				{},
				"Unknown '$ref' '#/$defs/Nope' in the schema for option 'm.^x-'",
			);
			rejects(
				schema({
					type: "object",
					patternProperties: { "^x-": { type: "string", bogus: 1 } },
				}),
				{},
				"Unknown schema keyword 'bogus' in the schema for option 'm.^x-'",
			);
		});
	});
});

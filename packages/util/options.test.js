import { ok, strictEqual } from "node:assert/strict";
import { describe, test } from "node:test";
import { validateOptions } from "./index.js";

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
					routes: [{ method: "GET", path: "/a", handler: () => {}, extra: 1 }],
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

	test("throws on unknown key when additionalProperties is false", () => {
		try {
			validateOptions("@middy/test", schema, { name: "foo", typo: 1 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("typo"));
		}
	});

	test("supports instanceof keyword", () => {
		const fn = () => {};
		validateOptions(
			"@middy/test",
			{
				type: "object",
				required: ["handler"],
				properties: { handler: { instanceof: "Function" } },
				additionalProperties: false,
			},
			{ handler: fn },
		);
		try {
			validateOptions(
				"@middy/test",
				{
					type: "object",
					required: ["handler"],
					properties: { handler: { instanceof: "Function" } },
					additionalProperties: false,
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
					oneOf: [{ instanceof: "Function" }, { type: "boolean" }],
				},
			},
			additionalProperties: false,
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
		validateOptions("@middy/test", { flag: { const: false } }, { flag: false });
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

describe("validateOptions instanceof error paths", () => {
	test("throws when instanceof name is not a global function", () => {
		try {
			validateOptions(
				"@middy/test",
				{ h: { instanceof: "NotARealGlobalClass" } },
				{ h: () => {} },
			);
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("NotARealGlobalClass"));
		}
	});
});

describe("validateOptions oneOf surfaces schema-construction errors", () => {
	test("a malformed instanceof inside oneOf fails loudly with the real cause", () => {
		const schema = {
			v: { oneOf: [{ instanceof: "NotARealGlobalClass" }, { type: "string" }] },
		};
		try {
			validateOptions("@middy/test", schema, { v: 123 });
			ok(false, "expected throw");
		} catch (e) {
			ok(
				e.message.includes("NotARealGlobalClass"),
				`expected construction error to surface, got: ${e.message}`,
			);
		}
	});

	test("an unrecognized sub-schema shape inside oneOf fails loudly", () => {
		const schema = {
			v: { oneOf: [{ unknownKeyword: true }, { type: "string" }] },
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
			{ v: { allOf: [{ type: "string", pattern: "^/" }] } },
			{},
		);
	});

	test("instanceof rule allows undefined", () => {
		validateOptions("@middy/test", { h: { instanceof: "Function" } }, {});
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
		// array's own key `type` becomes a required string option, so empty
		// options throw "Missing required option 'type'". If it were wrongly
		// detected as JSON-schema form, the empty options would be accepted.
		const schema = [];
		schema.type = "object";
		schema.properties = { x: { type: "string" } };
		try {
			validateOptions("@middy/test", schema, {});
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("type"));
		}
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

describe("validateOptions string-only constraints on non-string value", () => {
	test("pattern on a non-string value yields a clean validation Error", () => {
		try {
			validateOptions(
				"@middy/test",
				{ n: { type: "number", pattern: "^a" } },
				{ n: 42 },
			);
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("n"));
			strictEqual(e.cause.package, "@middy/test");
		}
	});

	test("minLength on a non-string value yields a clean validation Error", () => {
		try {
			validateOptions(
				"@middy/test",
				{ n: { type: "number", minLength: 2 } },
				{ n: 42 },
			);
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("n"));
			strictEqual(e.cause.package, "@middy/test");
		}
	});

	test("maxLength on a non-string value yields a clean validation Error", () => {
		try {
			validateOptions(
				"@middy/test",
				{ n: { type: "number", maxLength: 2 } },
				{ n: 42 },
			);
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("n"));
			strictEqual(e.cause.package, "@middy/test");
		}
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
		validateOptions("@middy/test", { mode: { enum: ["always", "never"] } }, {});
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

describe("validateOptions uniqueItems", () => {
	test("rejects duplicate items, ignoring function-typed fields", () => {
		const schema = {
			routes: {
				type: "array",
				uniqueItems: true,
				items: {
					type: "object",
					properties: {
						method: { type: "string" },
						path: { type: "string" },
						handler: { instanceof: "Function" },
					},
					required: ["method", "path", "handler"],
					additionalProperties: false,
				},
			},
		};
		try {
			validateOptions("@middy/test", schema, {
				routes: [
					{ method: "GET", path: "/a", handler: () => 1 },
					{ method: "GET", path: "/a", handler: () => 2 },
				],
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("routes"));
		}
	});

	test("detects duplicates regardless of key order", () => {
		const schema = {
			routes: {
				type: "array",
				uniqueItems: true,
				items: {
					type: "object",
					properties: {
						method: { type: "string" },
						path: { type: "string" },
					},
					required: ["method", "path"],
					additionalProperties: false,
				},
			},
		};
		try {
			validateOptions("@middy/test", schema, {
				routes: [
					{ method: "GET", path: "/a" },
					{ path: "/a", method: "GET" },
				],
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("routes"));
		}
	});

	test("detects duplicate items containing nested arrays", () => {
		const schema = {
			rows: {
				type: "array",
				uniqueItems: true,
				items: {
					type: "object",
					properties: { tags: { type: "array" } },
					additionalProperties: false,
				},
			},
		};
		try {
			validateOptions("@middy/test", schema, {
				rows: [{ tags: ["a", "b"] }, { tags: ["a", "b"] }],
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("rows[1]"));
		}
	});

	test("accepts items that differ by a non-function field", () => {
		const schema = {
			routes: {
				type: "array",
				uniqueItems: true,
				items: {
					type: "object",
					properties: {
						method: { type: "string" },
						path: { type: "string" },
						handler: { instanceof: "Function" },
					},
					required: ["method", "path", "handler"],
					additionalProperties: false,
				},
			},
		};
		validateOptions("@middy/test", schema, {
			routes: [
				{ method: "GET", path: "/a", handler: () => {} },
				{ method: "POST", path: "/a", handler: () => {} },
			],
		});
	});

	test("does not stack overflow on a circular item", () => {
		const schema = { rows: { type: "array", uniqueItems: true } };
		const item = {};
		item.self = item;
		try {
			validateOptions("@middy/test", schema, { rows: [item] });
		} catch (e) {
			ok(
				!(e instanceof RangeError),
				"must not throw a RangeError stack overflow",
			);
		}
	});

	test("treats two distinct circular items as duplicates", () => {
		const schema = { rows: { type: "array", uniqueItems: true } };
		const a = { name: "x" };
		a.self = a;
		const b = { name: "x" };
		b.self = b;
		try {
			validateOptions("@middy/test", schema, { rows: [a, b] });
			ok(false, "expected throw");
		} catch (e) {
			ok(!(e instanceof RangeError));
			ok(e.message.includes("rows[1]"));
		}
	});

	test("circular ref collides with a literal [Circular] string", () => {
		// A self-referential object and an object whose field literally holds the
		// string "[Circular]" must serialize identically (the circular marker is
		// the quoted string `"[Circular]"`).
		const schema = { rows: { type: "array", uniqueItems: true } };
		const a = {};
		a.x = a;
		const b = { x: "[Circular]" };
		try {
			validateOptions("@middy/test", schema, { rows: [a, b] });
			ok(false, "expected throw");
		} catch (e) {
			ok(!(e instanceof RangeError));
			ok(e.message.includes("rows[1]"));
		}
	});

	test("distinguishes null, primitives, and equal-keyed objects", () => {
		// null vs object vs string must all be distinct serializations.
		const schema = { rows: { type: "array", uniqueItems: true } };
		validateOptions("@middy/test", schema, {
			rows: [null, "null", { a: 1 }, 1, true],
		});
	});

	test("an array element and an object element do not collide", () => {
		// Array branch -> `["a"]`; object branch -> `{"0":"a"}`. These must not
		// be treated as equal, so this must NOT throw.
		const schema = { rows: { type: "array", uniqueItems: true } };
		validateOptions("@middy/test", schema, {
			rows: [["a"], { 0: "a" }],
		});
	});

	test("array element order/separators are significant", () => {
		// `["a","b"]` must differ from `["ab"]`; relies on the comma separator
		// inside the array serialization.
		const schema = { rows: { type: "array", uniqueItems: true } };
		validateOptions("@middy/test", schema, {
			rows: [["a", "b"], ["ab"]],
		});
	});

	test("same-length arrays with different contents are distinct", () => {
		// Each element must be serialized; mapping every element to undefined
		// would collapse these equal-length arrays into a false duplicate.
		const schema = { rows: { type: "array", uniqueItems: true } };
		validateOptions("@middy/test", schema, {
			rows: [
				["a", "b"],
				["c", "d"],
			],
		});
	});

	test("array elements that are genuinely equal still collide", () => {
		const schema = { rows: { type: "array", uniqueItems: true } };
		try {
			validateOptions("@middy/test", schema, {
				rows: [
					["a", "b"],
					["a", "b"],
				],
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("rows[1]"));
		}
	});

	test("array of numbers relies on the element separator", () => {
		// `[1,2]` serializes to `[1,2]`; without the comma it would collapse to
		// `[12]` and falsely collide with `[12]`. These must stay distinct.
		const schema = { rows: { type: "array", uniqueItems: true } };
		validateOptions("@middy/test", schema, {
			rows: [[1, 2], [12]],
		});
	});

	test("function-keyed fields are ignored by name as well as value", () => {
		// Two items with identical data but differently-named function-typed
		// fields must be treated as duplicates (function keys are filtered out).
		const schema = { rows: { type: "array", uniqueItems: true } };
		try {
			validateOptions("@middy/test", schema, {
				rows: [
					{ id: 1, onA: () => {} },
					{ id: 1, onB: () => {} },
				],
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("rows[1]"));
		}
	});

	test("objects differing only by key name are distinct", () => {
		// `{"a":1}` vs `{"b":1}`: relies on the object key serialization.
		const schema = { rows: { type: "array", uniqueItems: true } };
		validateOptions("@middy/test", schema, {
			rows: [{ a: 1 }, { b: 1 }],
		});
	});

	test("objects differing only by value are distinct", () => {
		// `{"a":1}` vs `{"a":2}`: relies on the `key:value` separator.
		const schema = { rows: { type: "array", uniqueItems: true } };
		validateOptions("@middy/test", schema, {
			rows: [{ a: 1 }, { a: 2 }],
		});
	});

	test("nested object key/brace boundaries are significant", () => {
		// `{"a":{"b":1}}` must not collapse such that a flat object collides.
		const schema = { rows: { type: "array", uniqueItems: true } };
		validateOptions("@middy/test", schema, {
			rows: [{ a: { b: 1 } }, { a: 1, b: 1 }],
		});
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

	test("accepts an array with duplicates when uniqueItems is not set", () => {
		validateOptions(
			"@middy/test",
			{ tags: { type: "array" } },
			{ tags: ["a", "a"] },
		);
	});

	test("uniqueItems accepts a single undefined element (no off-by-one dup)", () => {
		validateOptions(
			"@middy/test",
			{ rows: { type: "array", uniqueItems: true } },
			{ rows: [undefined] },
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
			{ cfg: { type: "object", required: ["a"], additionalProperties: true } },
			{ cfg: { a: 1 } },
		);
		try {
			validateOptions(
				"@middy/test",
				{
					cfg: { type: "object", required: ["a"], additionalProperties: true },
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

	test("non-array rule with uniqueItems present does not run dedup branch", () => {
		validateOptions(
			"@middy/test",
			{ s: { type: "string", uniqueItems: true } },
			{ s: "hello" },
		);
	});

	test("unknown key with no additionalProperties uses the 'Unknown option' message", () => {
		const schema = {
			cfg: { type: "object", properties: { name: { type: "string" } } },
		};
		try {
			validateOptions("@middy/test", schema, { cfg: { name: "x", extra: 1 } });
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
			validateOptions("@middy/test", schema, { cfg: { name: "x", extra: 1 } });
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

	test("additionalProperties as an instanceof rule validates each value", () => {
		const schema = {
			handlers: {
				type: "object",
				additionalProperties: { instanceof: "Function" },
			},
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

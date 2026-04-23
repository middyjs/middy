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

describe("validateOptions pattern", () => {
	test("accepts string matching pattern", () => {
		validateOptions(
			"@middy/test",
			{ path: { type: "string", pattern: "^/" } },
			{ path: "/foo" },
		);
	});

	test("rejects string not matching pattern", () => {
		try {
			validateOptions(
				"@middy/test",
				{ path: { type: "string", pattern: "^/" } },
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
				{ type: "string", pattern: "^/" },
				{ type: "string", pattern: "^(/|.*[^/])$" },
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

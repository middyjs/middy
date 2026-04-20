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

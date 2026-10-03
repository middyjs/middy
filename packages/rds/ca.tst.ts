import { expect, test } from "tstyche";
import ca from "./ca.js";

test("ca returns the PEM bundle as a string", () => {
	expect(ca()).type.toBe<string>();
});

test("ca takes no arguments", () => {
	expect(ca).type.not.toBeCallableWith("us-east-1");
});

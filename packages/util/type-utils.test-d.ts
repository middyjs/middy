import { expect } from "tstyche";
import type {
	ArrayValues,
	Choose,
	DeepAwaited,
	IsUnknown,
	RemoveAllLeadingUnderscore,
	RemoveRepeatedUnderscore,
	SanitizeKey,
	SanitizeKeyPrefixLeadingNumber,
	SanitizeKeyRemoveDisallowedChar,
	SanitizeKeys,
} from "./type-utils.js";

// SanitizeKeyPrefixLeadingNumber
// adds a leading _ if it starts with a number
expect<SanitizeKeyPrefixLeadingNumber<"1234">>().type.toBe<"_1234">();
expect<SanitizeKeyPrefixLeadingNumber<"01234">>().type.toBe<"_01234">();
// it does not add a leading _ if it starts with something else
expect<SanitizeKeyPrefixLeadingNumber<"abcd">>().type.toBe<"abcd">();
expect<SanitizeKeyPrefixLeadingNumber<"ABCD">>().type.toBe<"ABCD">();
expect<SanitizeKeyPrefixLeadingNumber<"?abcd">>().type.toBe<"?abcd">();
expect<SanitizeKeyPrefixLeadingNumber<"!abcd">>().type.toBe<"!abcd">();
expect<SanitizeKeyPrefixLeadingNumber<"@abcd">>().type.toBe<"@abcd">();
expect<SanitizeKeyPrefixLeadingNumber<"_abcd">>().type.toBe<"_abcd">();
expect<SanitizeKeyPrefixLeadingNumber<"-abcd">>().type.toBe<"-abcd">();

// SanitizeKeyRemoveDisallowedChar
// removes all disallowed chars and replaces them with _
expect<
	SanitizeKeyRemoveDisallowedChar<'1234!@#AA$%^&*()BBB_+{}|:"<>?~CC`-=[D]E\\;,./F'>
>().type.toBe<"1234___AA_______BBB___________CC____D_E_____F">();

// RemoveAllLeadingUnderscore
// removes all leading _
expect<RemoveAllLeadingUnderscore<"_1234">>().type.toBe<"1234">();
expect<RemoveAllLeadingUnderscore<"__1234">>().type.toBe<"1234">();
expect<RemoveAllLeadingUnderscore<"___1234">>().type.toBe<"1234">();
// it does not remove _ in the middle or at the end
expect<RemoveAllLeadingUnderscore<"1234">>().type.toBe<"1234">();
expect<RemoveAllLeadingUnderscore<"12_34">>().type.toBe<"12_34">();
expect<RemoveAllLeadingUnderscore<"1234_">>().type.toBe<"1234_">();

// RemoveRepeatedUnderscore
// removes all repeated _
expect<RemoveRepeatedUnderscore<"__1234">>().type.toBe<"_1234">();
expect<RemoveRepeatedUnderscore<"12__34">>().type.toBe<"12_34">();
expect<RemoveRepeatedUnderscore<"1234__">>().type.toBe<"1234_">();
expect<
	RemoveRepeatedUnderscore<"12_________________34">
>().type.toBe<"12_34">();
// does not remove single underscores or other characters
expect<RemoveRepeatedUnderscore<"_1234">>().type.toBe<"_1234">();
expect<RemoveRepeatedUnderscore<"1234">>().type.toBe<"1234">();

// SanitizeKey
// combines all the above
expect<
	SanitizeKey<"api//secret-key0.pem">
>().type.toBe<"api_secret_key0_pem">();
expect<SanitizeKey<"0key.0key">>().type.toBe<"_0key_0key">();

// SanitizeKeys
// sanitizes all keys in an object
expect<SanitizeKeys<{ "0key": 0 }>>().type.toBe<{ _0key: 0 }>();
expect<SanitizeKeys<{ "api//secret-key0.pem": 0 }>>().type.toBe<{
	api_secret_key0_pem: 0;
}>();
expect<SanitizeKeys<{ "0key": 0; "api//secret-key0.pem": 0 }>>().type.toBe<{
	_0key: 0;
	api_secret_key0_pem: 0;
}>();

// DeepAwaited
expect<
	DeepAwaited<{
		level1: { level2: Promise<Promise<{ innerPromise: Promise<22> }>> };
	}>
>().type.toBe<{
	level1: {
		level2: {
			innerPromise: Promise<22>; // Note: getInternal does not recurse into resolved promises
		};
	};
}>();

// Choose
interface TestChoose {
	boolean: true;
	number: 1;
	string: "string";
	array: [];
	object: {
		key: "value";
	};
	promise: Promise<string>;
	promiseObject: Promise<{
		key: "value";
	}>;
}
expect<Choose<TestChoose, "boolean">>().type.toBe<true>();
expect<Choose<TestChoose, "number">>().type.toBe<1>();
expect<Choose<TestChoose, "object.key">>().type.toBe<"value">();
expect<Choose<TestChoose, "promise">>().type.toBe<Promise<string>>();
expect<Choose<DeepAwaited<TestChoose>, "promise">>().type.toBe<string>();
expect<Choose<TestChoose, "promiseObject">>().type.toBe<
	Promise<{ key: "value" }>
>();
expect<Choose<DeepAwaited<TestChoose>, "promiseObject">>().type.toBe<{
	key: "value";
}>();

// IsUnknown
expect<IsUnknown<unknown>>().type.toBe<true>();
expect<IsUnknown<any>>().type.toBe<true>();
expect<IsUnknown<never>>().type.toBe<false>();
expect<IsUnknown<undefined>>().type.toBe<false>();
expect<IsUnknown<null>>().type.toBe<false>();
expect<IsUnknown<string>>().type.toBe<false>();
expect<IsUnknown<number>>().type.toBe<false>();
expect<IsUnknown<boolean>>().type.toBe<false>();
expect<IsUnknown<{}>>().type.toBe<false>();
expect<IsUnknown<[]>>().type.toBe<false>();
expect<IsUnknown<{ key: "value" }>>().type.toBe<false>();
expect<IsUnknown<Promise<string>>>().type.toBe<false>();

// ArrayValues
expect<ArrayValues<["a", "b", "c"]>>().type.toBe<"a" | "b" | "c">();

---
title: Utilities
description: "Explore Middy utility functions for internal storage, caching, and middleware development."
---

`@middy/util` holds the helpers the official middlewares are built on. They are public, so custom middlewares can use them too.

```bash npm2yarn
npm install --save @middy/util
```

Signatures below are simplified from `@middy/util/index.d.ts`, which has the full generic types.

## Errors

- `new HttpError(code: number, options?: { cause?, expose? })`: an `Error` with `status`, `statusCode` and `expose` (defaults to `code < 500`). The message is always the reason phrase for `code` (e.g. `Not Found`); put failure details in `cause.data`, which stays server-side. [`@middy/http-error-handler`](/docs/middlewares/http-error-handler) turns it into a response.

## Internal storage and context

- `getInternal(variables, request): Promise<object>`: resolves values from `request.internal`, awaiting any promises. `variables` is `true` (every key), a key, an array of keys, or an object mapping new names to keys. Dotted paths (`'key.nested'`) read into a value. Result keys are passed through `sanitizeKey`. Returns `{}` when `variables` is falsy or `request` has no `internal`.
- `sanitizeKey(key: string): string`: replaces each run of characters outside `a-zA-Z0-9` with `_` and prefixes a leading digit with `_`.
- `contextNamespace(request, contextKey: string): object`: returns `context.middyContext[contextKey]`, creating it if missing, for merging key/value data into.
- `setContextNamespace(request, contextKey: string, value: unknown): void`: publishes a single value at `context.middyContext[contextKey]`.
- `buildSetToContextSpec(options: { fetchData, setToContext?, contextKey? }): SetToContextSpec | null`: called once at factory time; `null` when `setToContext` is off. Throws a `TypeError` when two `fetchData` keys sanitize to the same name.
- `assignSetToContext(spec, value, request): Promise<void> | undefined`: called per invocation to copy fetched values to `context.middyContext`. Returns `undefined` when every value is already resolved.

See [Internal Storage](/docs/writing-middlewares/internal-storage) for how these fit together.

## Cache

- `processCache(options, fetch: (request, cachedValues) => unknown, request?): { value, expiry }`: serves `options.cacheKey` from the shared cache or calls `fetch`. A background refresh gets an empty request, so pass the request as the third argument rather than closing over it.
- `canPrefetch(options): boolean`: whether the middleware can fetch at construction. Throws when `cacheExpiry` is above `86400000` (read as a unix timestamp) but before 2001-01-01.
- `getCache(key: string)`: the cache entry for `key`, or `{}`.
- `modifyCache(cacheKey: string, value: unknown): void`: replaces an entry's value and flags it modified, so `processCache` refetches only the missing keys.
- `clearCache(keys?: string | string[] | null): void`: removes the given entries, or every entry when called without keys.
- `evictCacheOnFailure(cacheKey: string, internalKey: string, values?)`: `.catch` handler for a per-key fetch; drops the failed key from the cached value and rethrows.
- `setCacheKeyExpiry(options, expiryMs: number): void`: records an absolute expiry (unix ms) learned from a fetched value. The entry then expires at the sooner of it and `cacheExpiry`; it never extends the configured lifetime.

## AWS clients

- `createPrefetchClient(options)`: builds `new options.AwsClient(options.awsClientOptions)` at construction time.
- `createClient(options, request): Promise<Client>`: builds the client per invocation, using the credentials under `awsClientAssumeRole` in `request.internal` when set.
- `createClientInit(options): (request) => Promise<Client>`: memoized `createClient`; a rejected attempt is forgotten so the next invocation retries.
- `catchInvalidSignatureException(e, client, command): Promise<unknown>`: retries `client.send(command)` once when `e.__type` is `InvalidSignatureException`, otherwise rethrows.

## Options validation

- `validateOptions(packageName: string, schema: OptionSchema, options?): options`: checks options against a JSON-Schema-shaped `schema` (`{ type: 'object', properties, additionalProperties }`) and throws a `TypeError` naming the offending option. Official middlewares wrap it in a named export such as `ssmValidateOptions`; see [Validating options](/docs/intro/validating-options).

## Logging redaction

- `buildPathTree(paths: Array<string | Array<string | number>>): PathTree`: compiles dot-delimited paths relative to the request (e.g. `event.headers.authorization`, `[]` for array elements) into a lookup. Segments match keys case-insensitively.
- `omit(value, pathTree?, mask?: string)`: returns `value` unchanged when no path applies, otherwise a shallow clone with the matched leaves removed, or replaced by `mask`. `Error` values are normalized to a plain object first.

## HTTP and JSON

- `jsonSafeParse(text, reviver?)`: `JSON.parse` that returns the input unchanged when it is not a string, does not start with `{`, `[` or `"`, or fails to parse.
- `jsonParseProtectProto(text, reviver?, packageName?)`: `JSON.parse` that throws a `422` `HttpError` when the payload has an own `__proto__` key or a `constructor.prototype` key.
- `isJsonStructured(text): boolean`: whether a string starts with `{` or `[`.
- `jsonContentTypePattern: RegExp`: matches `application/json` and `application/*+json` content types.
- `decodeBody(body, isBase64Encoded?)`: base64-decodes `body` when `isBase64Encoded`; returns a nullish body unchanged.
- `normalizeHttpResponse(request)`: shapes `request.response` into `{ statusCode, headers, body }` (a bare value becomes the `body` of a `200`) and returns it.
- `resolveHttpEventVersion(event): string`: `event.version` when set, `"vpc"` for a VPC Lattice V1 event, else `"1.0"`.

## Runtime

- `lambdaContextKeys: string[]`: the documented Lambda context property names.
- `isExecutionModeDurable(context): boolean`: whether `context` is the durable execution context.

---
title: http-jwt
description: "Verify JWTs on incoming HTTP requests using a static secret or a public key fetched from @middy/kms."
status: alpha
---

Verifies a JSON Web Token (JWT) on incoming HTTP requests and attaches the decoded payload to `request.internal` and `request.context`. The token can be read from the `Authorization: Bearer ...` header (default) or from a cookie.

Two key sources are supported:

- A **shared secret** (`secretKey`) for HMAC algorithms like `HS256`.
- A **public key from `request.internal`** (`internalKey`), typically populated by [`@middy/kms`](/docs/middlewares/kms) when the signing key lives in AWS KMS. RSA, ECC NIST P-curve, and Ed25519 KMS key specs are mapped to the corresponding JWS algorithm automatically.

This middleware does **not** check role / scope / permission claims. See [Validating roles](#validating-roles) below for a small custom middleware you can drop in alongside it.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-jwt
npm install --save jose
```

## Options

- `secretKey` (string) (optional): Symmetric secret used to verify the token. Required when no `internalKey` is provided. Must be paired with `algorithm`.
- `internalKey` (string) (optional): Key on `request.internal` holding the verification key. Typically the key populated by `@middy/kms` (`{ publicKey, keySpec }`). Required when `secretKey` is not set.
- `algorithm` (string) (optional): JWS algorithm to enforce (e.g. `HS256`, `RS256`, `ES256`, `EdDSA`). Required when using `secretKey`. When using `internalKey` with a KMS-sourced key, the algorithm is inferred from `keySpec` if not provided.
- `cookieName` (string) (optional): When set, the token is read from this cookie name instead of the `Authorization` header.
- `audience` (string | string[]) (optional): Expected `aud` claim. Verification fails if the token's audience does not match.
- `issuer` (string | string[]) (optional): Expected `iss` claim.
- `clockTolerance` (number) (default `0`): Clock skew tolerance in seconds applied to `exp`/`nbf` checks.
- `payloadKey` (string) (default `jwt`): Key under which the decoded payload is stored on both `request.internal` and `request.context`.

NOTES:

- A missing or malformed token, an invalid signature, or a failed claim check throws a `401 Unauthorized`. Pair with [`http-error-handler`](/docs/middlewares/http-error-handler) to convert it into a proper HTTP response.
- Exactly one of `secretKey` or `internalKey` must be provided.

## Sample usage

### With a shared secret (HS256)

```javascript
import middy from '@middy/core'
import httpJwt from '@middy/http-jwt'
import httpErrorHandler from '@middy/http-error-handler'

const lambdaHandler = (event, context) => {
  // context.jwt holds the decoded payload
  return { statusCode: 200, body: JSON.stringify({ sub: context.jwt.sub }) }
}

export const handler = middy()
  .use(
    httpJwt({
      secretKey: process.env.JWT_SECRET,
      algorithm: 'HS256',
      issuer: 'https://auth.example.com',
      audience: 'api.example.com',
      clockTolerance: 5,
    }),
  )
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

### With a KMS-hosted public key

Pair `@middy/kms` with `@middy/http-jwt` to verify tokens that were signed with an AWS KMS asymmetric key. The KMS middleware fetches the public key once per cold start and caches it; `http-jwt` reads it via `internalKey` and derives the algorithm from the key spec.

```javascript
import middy from '@middy/core'
import kms from '@middy/kms'
import httpJwt from '@middy/http-jwt'
import httpErrorHandler from '@middy/http-error-handler'

const lambdaHandler = (event, context) => {
  return { statusCode: 200, body: JSON.stringify({ sub: context.jwt.sub }) }
}

export const handler = middy()
  .use(
    kms({
      fetchData: {
        jwtKey: 'alias/jwt-signing-key',
      },
    }),
  )
  .use(
    httpJwt({
      internalKey: 'jwtKey',
      issuer: 'https://auth.example.com',
      audience: 'api.example.com',
    }),
  )
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

### Reading the token from a cookie

```javascript
httpJwt({
  secretKey: process.env.JWT_SECRET,
  algorithm: 'HS256',
  cookieName: 'session',
})
```

## Validating roles

`@middy/http-jwt` only verifies the signature and standard claims (`iss`, `aud`, `exp`, `nbf`). Role / scope / permission claims are application-specific and intentionally left to userland. The following inline middleware reads the decoded payload from `request.context` (under `payloadKey`) and rejects the request when the required role is missing.

```javascript
import middy from '@middy/core'
import httpJwt from '@middy/http-jwt'
import httpErrorHandler from '@middy/http-error-handler'
import { createError } from '@middy/util'

const requireRole = (requiredRole, { payloadKey = 'jwt', claim = 'roles' } = {}) => ({
  before: (request) => {
    const payload = request.context[payloadKey]
    const roles = payload?.[claim]
    const has = Array.isArray(roles)
      ? roles.includes(requiredRole)
      : roles === requiredRole
    if (!has) {
      throw createError(403, 'Forbidden', {
        cause: { package: 'custom/require-role', data: `Missing role: ${requiredRole}` },
      })
    }
  },
})

const lambdaHandler = (event, context) => {
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}

export const handler = middy()
  .use(httpJwt({ secretKey: process.env.JWT_SECRET, algorithm: 'HS256' }))
  .use(requireRole('admin'))
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

Order matters: `requireRole` must run **after** `httpJwt` so the decoded payload is already on the context.

## Bundling

`jose` is a peer dependency. To keep it out of your Lambda bundle, add `jose` to your bundler's exclude list and provide it via a Lambda Layer.

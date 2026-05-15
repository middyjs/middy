---
title: http-paseto
description: "Verify PASETO v4.public tokens on incoming HTTP requests using a public key fetched from @middy/kms."
status: alpha
---

Verifies a [PASETO](https://paseto.io) `v4.public` token on incoming HTTP requests and attaches the decoded payload to `request.internal` and `request.context`. The token can be read from the `Authorization: Bearer ...` header (default) or from a cookie.

The verification key is read from `request.internal` under `internalKey`, typically populated by [`@middy/kms`](/docs/middlewares/kms) when the Ed25519 signing key lives in AWS KMS.

Only `v4.public` (Ed25519-signed) tokens are accepted. `v4.local`, `v3.*`, `v2.*`, and `v1.*` are rejected with `401 Unauthorized`.

This middleware does **not** check role / scope / permission claims. See [Validating roles](#validating-roles) below for a small custom middleware you can drop in alongside it.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-paseto
npm install --save paseto
```

## Options

- `internalKey` (string) (required): Key on `request.internal` holding the verification key. Typically the key populated by `@middy/kms` (`{ publicKey, keySpec }` where `keySpec` is `ECC_NIST_ED25519`).
- `cookieName` (string) (optional): When set, the token is read from this cookie name instead of the `Authorization` header.
- `audience` (string) (optional): Expected `aud` claim.
- `issuer` (string) (optional): Expected `iss` claim.
- `clockTolerance` (string) (optional): Clock skew tolerance forwarded to `paseto`'s `V4.verify` (e.g. `"5 seconds"`). See the [paseto docs](https://github.com/panva/paseto) for accepted formats.
- `payloadKey` (string) (default `paseto`): Key under which the decoded payload is stored on both `request.internal` and `request.context`.

NOTES:

- A missing or malformed token, an unsupported version/purpose, an invalid signature, or a failed claim check throws a `401 Unauthorized`. Pair with [`http-error-handler`](/docs/middlewares/http-error-handler) to convert it into a proper HTTP response.
- The KMS key behind a PASETO `v4.public` deployment must be an Ed25519 key (`ECC_NIST_ED25519`).

## Sample usage

### With a KMS-hosted public key

```javascript
import middy from '@middy/core'
import kms from '@middy/kms'
import httpPaseto from '@middy/http-paseto'
import httpErrorHandler from '@middy/http-error-handler'

const lambdaHandler = (event, context) => {
  // context.paseto holds the decoded payload
  return { statusCode: 200, body: JSON.stringify({ sub: context.paseto.sub }) }
}

export const handler = middy()
  .use(
    kms({
      fetchData: {
        pasetoKey: 'alias/paseto-signing-key',
      },
    }),
  )
  .use(
    httpPaseto({
      internalKey: 'pasetoKey',
      issuer: 'https://auth.example.com',
      audience: 'api.example.com',
      clockTolerance: '5 seconds',
    }),
  )
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

### Reading the token from a cookie

```javascript
httpPaseto({
  internalKey: 'pasetoKey',
  cookieName: 'session',
})
```

## Validating roles

`@middy/http-paseto` only verifies the signature and standard claims (`iss`, `aud`, `exp`, `nbf`). Role / scope / permission claims are application-specific. The following inline middleware reads the decoded payload from `request.context` (under `payloadKey`) and rejects the request when the required role is missing.

```javascript
import middy from '@middy/core'
import kms from '@middy/kms'
import httpPaseto from '@middy/http-paseto'
import httpErrorHandler from '@middy/http-error-handler'
import { createError } from '@middy/util'

const requireRole = (requiredRole, { payloadKey = 'paseto', claim = 'roles' } = {}) => ({
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
  .use(kms({ fetchData: { pasetoKey: 'alias/paseto-signing-key' } }))
  .use(httpPaseto({ internalKey: 'pasetoKey' }))
  .use(requireRole('admin'))
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

Order matters: `requireRole` must run **after** `httpPaseto` so the decoded payload is already on the context.

## Bundling

`paseto` is a peer dependency. To keep it out of your Lambda bundle, add `paseto` to your bundler's exclude list and provide it via a Lambda Layer.

---
title: http-paseto
description: "Verify PASETO v4.public tokens on incoming HTTP requests using a public key fetched from @middy/kms."
status: alpha
---

Verifies a [PASETO](https://paseto.io) `v4.public` token on incoming HTTP requests. The verified payload is written to `request.internal[payloadKey]` (and optionally to `request.context[payloadKey]` when `setToContext: true`).

The token is resolved from the first available source in this order: cookie, header, query string. When no source is configured the middleware falls back to the `Authorization: Bearer ...` header.

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

- `internalKey` (string) (required): Key on `request.internal` holding the verification key. Typically the key populated by `@middy/kms` (`{ publicKey, keySpec }` where `keySpec` is `ECC_NIST_ED25519`), but a `Uint8Array` of DER SPKI bytes and an already-resolved `KeyObject` are both accepted too. It may also hold an **array** of any of those; see [Key rotation](#key-rotation).
- `tokenCookieName` (string) (optional): Cookie name to read the token from.
- `tokenHeaderName` (string) (optional): Custom header to read the token from. When the name is `Authorization` (case-insensitive), the `Bearer ` scheme is stripped; any other scheme causes the source to fall through. Other header names return the raw value.
- `tokenQueryStringName` (string) (optional): Query-string parameter to read the token from.
- `audience` (string) (optional): Expected `aud` claim.
- `issuer` (string) (optional): Expected `iss` claim.
- `clockTolerance` (string) (optional): Clock skew tolerance forwarded to `paseto`'s `V4.verify` (e.g. `"5 seconds"`). See the [paseto docs](https://github.com/panva/paseto) for accepted formats.
- `requiredClaims` (object) (optional): Claims the payload must carry, compared with strict equality, e.g. `{ typ: 'access' }`. A claim that is absent fails the same way a claim with the wrong value does. Checked after the signature and before the payload is published, so nothing downstream can read a payload this rejected.
- `payloadKey` (string) (default `paseto`): Key under which the decoded payload is stored.
- `setToContext` (boolean) (default `false`): When `true`, the verified payload is also published to `request.context.middyContext[payloadKey]`. By default it is written only to `request.internal[payloadKey]` (matches `@middy/ssm` and `@middy/secrets-manager`). There is no separate `contextKey`: `payloadKey` names both.

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

const lambdaHandler = async (event) => {
  // The verified payload is on request.internal.paseto by default.
  // To use context.middyContext.paseto as below, pass setToContext: true to httpPaseto.
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
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
  tokenCookieName: 'session',
})
```

## Key rotation

An asymmetric signing key cannot be rotated in place. AWS KMS, for one, offers automatic and on-demand rotation for symmetric keys only, so rotating a `v4.public` signing key means standing up a **second** key and accepting both until the last token signed by the retiring one has expired.

Point `internalKey` at an array to do that. Each key is tried in order and the first success wins, so put the current key first:

```javascript
export const handler = middy()
  .before((request) => {
    // Two keys are genuinely current during the overlap. Order matters only for
    // which failure is reported, not for which tokens verify.
    request.internal.pasetoKeys = [currentKey, retiringKey]
  })
  .use(httpPaseto({ internalKey: 'pasetoKeys' }))
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

A token signed by any configured key verifies. A token signed by none is a `401`, the same as with a single key. Once the retiring key's last token has expired, drop it from the array.

Because the public half of an asymmetric key never changes, there is nothing to refetch at runtime and no staleness to revalidate. That makes a plain environment variable a reasonable place to keep it, which is why a resolved `KeyObject` is accepted alongside the raw bytes:

```javascript
import { createPublicKey } from 'node:crypto'

// PEM bundle in the environment -> KeyObject[], resolved once at module load.
const keys = process.env.PASETO_PUBLIC_KEYS.split(/(?=-----BEGIN)/)
  .map((pem) => createPublicKey(pem))

export const handler = middy()
  .use({ before: (request) => { request.internal.pasetoKeys = keys } })
  .use(httpPaseto({ internalKey: 'pasetoKeys' }))
  .handler(lambdaHandler)
```

## Requiring claims

A token that verifies is not automatically a token for *this*. Most issuers stamp a discriminator saying what kind of token it is: PASETO's own `typ`, Amazon Cognito's `token_use`, or a claim of your own. Accepting an ID token where an access token was meant, or a long-lived credential where a short-lived token was meant, is a real and common hole.

`requiredClaims` closes it declaratively:

```javascript
httpPaseto({
  internalKey: 'pasetoKey',
  // Only a short-lived access token is a token for calling this API. A credential
  // that merely buys one is refused here, even though it verifies.
  requiredClaims: { typ: 'access' },
})
```

Comparison is strict equality. A claim the payload does not carry at all fails the same way a wrong value does, which is what you want: a credential minted before the discriminator existed must not slide through.

For anything beyond an exact match, such as a scope that must contain a value, write a small middleware; see [Validating roles](#validating-roles) below.

## Validating roles

`@middy/http-paseto` only verifies the signature and standard claims (`iss`, `aud`, `exp`, `nbf`). Role / scope / permission claims are application-specific. The following inline middleware reads the decoded payload from `request.internal` (under `payloadKey`) and rejects the request when the required role is missing.

```javascript
import middy from '@middy/core'
import kms from '@middy/kms'
import httpPaseto from '@middy/http-paseto'
import httpErrorHandler from '@middy/http-error-handler'
import { HttpError } from '@middy/util'

const requireRole = (requiredRole, { payloadKey = 'paseto', claim = 'roles' } = {}) => ({
  before: (request) => {
    const payload = request.internal[payloadKey]
    const roles = payload?.[claim]
    const has = Array.isArray(roles)
      ? roles.includes(requiredRole)
      : roles === requiredRole
    if (!has) {
      throw new HttpError(403, {
        cause: {
          package: 'custom/require-role',
          data: { reason: 'Missing role', requiredRole },
        },
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

Order matters: `requireRole` must run **after** `httpPaseto` so the decoded payload is already on `request.internal`.

## Bundling

`paseto` is a peer dependency. To keep it out of your Lambda bundle, add `paseto` to your bundler's exclude list and provide it via a Lambda Layer.

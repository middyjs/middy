---
title: http-jwt
description: "Verify JWTs on incoming HTTP requests. Supports JWKS endpoints (OIDC providers like Cognito, Auth0, Okta), KMS-hosted keys, and request-supplied secrets via internalKey."
status: alpha
---

Verifies a JSON Web Token (JWT) on incoming HTTP requests. The verified payload is written to `request.internal[payloadKey]` (and optionally to `request.context[payloadKey]` when `setToContext: true`).

The token is resolved from the first available source in this order: cookie, header, query string. When no source is configured the middleware falls back to the `Authorization: Bearer ...` header.

Two key-source modes are supported:

- **`issuers` (recommended for OIDC).** A map of issuer URL → `{ jwksUri, audience, algorithm? }`. The middleware reads the token's `iss` claim, looks up the matching entry, fetches the public key from that issuer's JWKS (matched by `kid`), and verifies. Supports multiple issuers in one config. Key rotation, kid lookup, JWKS caching, and refresh-on-miss are handled internally via `jose.createRemoteJWKSet`.
- **`internalKey`.** Reads a key from `request.internal[internalKey]`, populated by another middleware that ran earlier. Used for KMS-hosted public keys (via [`@middy/kms`](/docs/middlewares/kms)), bare keys, or symmetric (HMAC) secrets.

This middleware does **not** check role / scope / permission claims. See [Validating roles](#validating-roles) below for a small custom middleware you can drop in alongside it.

## Install

```bash npm2yarn
npm install --save @middy/http-jwt
npm install --save jose
```

## Options

- `issuers` (object) (one of `issuers`/`internalKey` required): Map of issuer URL → `{ jwksUri, audience?, algorithm? }`. See [Issuers options](#issuers-options) for entry shape.
- `internalKey` (string) (one of `issuers`/`internalKey` required): Key on `request.internal` holding the verification key. Accepts a `{ publicKey: Uint8Array, keySpec }` shape from `@middy/kms`, a bare `Uint8Array` SPKI DER public key, or a string symmetric secret.
- `algorithm` (string | string[]) (required for `issuers`; required for `internalKey` bare-key/HMAC shapes; auto-inferred for KMS shape): JWS algorithm allowlist. `'none'` is rejected. Empty arrays are rejected.
- `tokenCookieName` (string) (optional): Cookie name to read the token from.
- `tokenHeaderName` (string) (optional): Custom header to read the token from. When the name is `Authorization` (case-insensitive), the `Bearer ` scheme is stripped; any other scheme causes the source to fall through. Other header names return the raw value.
- `tokenQueryStringName` (string) (optional): Query-string parameter to read the token from.
- `audience` (string | string[]) (optional, ignored when `issuers` is used — per-entry audience is authoritative): Expected `aud` claim.
- `issuer` (string | string[]) (optional, ignored when `issuers` is used): Expected `iss` claim.
- `clockTolerance` (number) (default `0`): Clock skew tolerance in seconds applied to `exp`/`nbf` checks.
- `payloadKey` (string) (default `jwt`): Key under which the decoded payload is stored.
- `setToContext` (boolean) (default `false`): When `true`, the verified payload is also written to `request.context[payloadKey]`. By default it is written only to `request.internal[payloadKey]` (matches `@middy/ssm` and `@middy/secrets-manager`).
- `cacheExpiry` (number) (optional, `issuers` only): JWKS cache TTL in ms. Forwarded to `jose.createRemoteJWKSet`'s `cacheMaxAge`.
- `cooldownDuration` (number) (optional, `issuers` only): Minimum interval in ms between JWKS refetches on `kid` miss. Forwarded to `jose.createRemoteJWKSet`'s `cooldownDuration`.
- `disablePrefetch` (boolean) (default `false`, `issuers` only): Skip the warm-up fetch fired at factory time for each issuer entry.

NOTES:

- A missing or malformed token, an invalid signature, or a failed claim check throws `401 Unauthorized`. Pair with [`http-error-handler`](/docs/middlewares/http-error-handler) to convert it into a proper HTTP response.
- HMAC secrets (HS256/HS384/HS512) work via `internalKey`. There is no top-level `secretKey` option; see [the HS256 example](#with-an-hmac-shared-secret-hs256) for the recommended shape. Asymmetric crypto (RS256/ES256) is strongly preferred for cross-service auth; HMAC is fine for webhook signatures and contained internal trust boundaries where you control both signer and verifier.

## Sample usage

### Verifying tokens from OIDC providers (Cognito, Auth0, Okta, etc.)

`@middy/http-jwt` ships first-class support for JWKS-based verification via the `issuers` option. Configure one entry per issuer URL; on each request the middleware reads the token's (unverified) `iss` claim, looks up the entry, fetches the matching public key from that issuer's JWKS by `kid`, and verifies. Key rotation, kid lookup, JWKS caching, and refresh-on-miss are handled internally.

```javascript
import middy from '@middy/core'
import httpJwt from '@middy/http-jwt'
import httpErrorHandler from '@middy/http-error-handler'

const { COGNITO_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID } = process.env

const COGNITO_ISSUER = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`

const lambdaHandler = async (event) => {
  // The verified payload is on request.internal.jwt by default.
  // To use context.jwt as below, pass setToContext: true to httpJwt.
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}

export const handler = middy()
  .use(
    httpJwt({
      issuers: {
        [COGNITO_ISSUER]: {
          jwksUri: `${COGNITO_ISSUER}/.well-known/jwks.json`,
          audience: COGNITO_CLIENT_ID,
        },
      },
      algorithm: 'RS256',
    }),
  )
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

### Multi-pool / multi-issuer

The `issuers` map naturally supports more than one IdP. The middleware reads the token's `iss` claim, routes to the matching entry, and verifies with that entry's JWKS and audience. A token whose `iss` does not match any entry is rejected with 401 (`cause.data: 'Unknown issuer'`). A token claiming `iss: A` but signed by a key from another pool fails verification because pool A's JWKS does not contain the signing key.

```javascript
const REGION = 'us-east-1'
const POOL_A = 'us-east-1_AAA'
const POOL_B = 'us-east-1_BBB'

httpJwt({
  issuers: {
    [`https://cognito-idp.${REGION}.amazonaws.com/${POOL_A}`]: {
      jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_A}/.well-known/jwks.json`,
      audience: 'pool-a-client-id',
    },
    [`https://cognito-idp.${REGION}.amazonaws.com/${POOL_B}`]: {
      jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_B}/.well-known/jwks.json`,
      audience: ['pool-b-client-id-1', 'pool-b-client-id-2'],
    },
  },
  algorithm: 'RS256',
})
```

### Mixed algorithms

Each issuer entry can override the top-level `algorithm`. `algorithm` is `string | string[]`, useful during IdP key-rotation windows where a JWKS temporarily contains both RS256 and ES256 keys.

```javascript
httpJwt({
  issuers: {
    'https://cognito-idp.us-east-1.amazonaws.com/POOL': {
      jwksUri: '...',
      audience: 'client',
      // inherits algorithm: 'RS256'
    },
    'https://my-es256-idp.example.com': {
      jwksUri: 'https://my-es256-idp.example.com/.well-known/jwks.json',
      audience: 'client',
      algorithm: 'ES256', // per-issuer override
    },
    'https://rotating-idp.example.com': {
      jwksUri: 'https://rotating-idp.example.com/jwks.json',
      audience: 'client',
      algorithm: ['RS256', 'ES256'], // accept either during rotation
    },
  },
  algorithm: 'RS256',
})
```

### Issuers options

Top-level (see [Options](#options) for full details on each):

- `issuers` (required), `algorithm` (required), `cacheExpiry`, `cooldownDuration`, `disablePrefetch`, `clockTolerance`, `setToContext`, `payloadKey`, token-source options.

Per entry:

- `jwksUri` (string, required): JWKS document URL.
- `audience` (string | string[], optional): Expected `aud` claim for tokens routed to this entry.
- `algorithm` (string | string[], optional): Per-issuer override of the top-level allowlist. Replaces (does not merge with) the top-level for this entry.

### With a KMS-hosted public key

Pair `@middy/kms` with `@middy/http-jwt` to verify tokens signed with an AWS KMS asymmetric key. The KMS middleware fetches the public key once per cold start and caches it; `http-jwt` reads it via `internalKey` and derives the algorithm from the key spec.

```javascript
import middy from '@middy/core'
import kms from '@middy/kms'
import httpJwt from '@middy/http-jwt'
import httpErrorHandler from '@middy/http-error-handler'

const lambdaHandler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
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
      // algorithm omitted: inferred from the KMS keySpec carried on internal.
      issuer: 'https://auth.example.com',
      audience: 'api.example.com',
    }),
  )
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

### With an HMAC shared secret (HS256)

There is no top-level `secretKey` option. Symmetric secrets flow through the same `internalKey` contract as every other key shape: a small middleware that places the secret on `request.internal` before `http-jwt` runs.

This shape works well for webhook signature verification (e.g., a third-party webhook that signs payloads with a shared secret), or for a contained internal trust boundary where you control both signer and verifier. For cross-service auth, prefer JWKS (`issuers` mode) or KMS — see the security note below.

```javascript
import middy from '@middy/core'
import httpJwt from '@middy/http-jwt'
import httpErrorHandler from '@middy/http-error-handler'

const provideHmacSecret = ({ internalKey = 'hmacSecret' } = {}) => ({
  before: (request) => {
    request.internal[internalKey] = process.env.JWT_SECRET
  },
})

const lambdaHandler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}

export const handler = middy()
  .use(provideHmacSecret())
  .use(
    httpJwt({
      internalKey: 'hmacSecret',
      algorithm: 'HS256',          // required: pinned, security gate against alg substitution
      issuer: 'https://auth.example.com',
      audience: 'api.example.com',
      clockTolerance: 5,
    }),
  )
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

For multi-secret rotation, the `before` middleware can pick a secret based on a non-standard header or a custom claim (e.g., a `kid` you mint yourself) and place the chosen secret on `request.internal`. Keep the `algorithm` allowlist pinned in `httpJwt` either way.

### Reading the token from a cookie

```javascript
httpJwt({
  issuers: {
    [COGNITO_ISSUER]: { jwksUri: `${COGNITO_ISSUER}/.well-known/jwks.json`, audience: 'client' },
  },
  algorithm: 'RS256',
  tokenCookieName: 'session',
})
```

### Resolving across cookie, header, and query string

When more than one source is configured the middleware tries each in order (cookie, header, query string) and uses the first match. Useful for APIs that accept tokens from a session cookie for browser clients and an `Authorization: Bearer` header for service clients.

```javascript
httpJwt({
  issuers: {
    [COGNITO_ISSUER]: { jwksUri: `${COGNITO_ISSUER}/.well-known/jwks.json`, audience: 'client' },
  },
  algorithm: 'RS256',
  tokenCookieName: 'session',
  tokenHeaderName: 'Authorization',
  tokenQueryStringName: 'id_token',
})
```

### Security note

The patterns above are safe against the two classic JWT verification mistakes:

- **`alg` substitution.** Attackers can place `alg: none` or `alg: HS256` in the protected header to try to bypass signature checks or use an RSA public key as an HMAC secret. The defenses are: (1) the `algorithm` allowlist is pinned by configuration, never read from the token; (2) in the JWKS path the lookup is also filtered by that allowlist, so a token claiming an unconfigured `alg` cannot find a key at all; (3) `algorithm: 'none'` is rejected at factory time.
- **Untrusted JWKS source.** Each `jwksUri` is configured once at factory time. `jose.createRemoteJWKSet` ignores any `jku` claim in the token header, so an attacker cannot redirect key fetching to a server they control. The `kid` from the token header is a *selector* into a trusted JWKS, not a source of trust on its own — an unknown `kid` fails the lookup, and the attacker cannot forge a signature without the IdP's private key.

### When to use which mode

- **JWKS (`issuers`)**: any OIDC/OAuth2-style cross-service auth where the IdP publishes a public keyset endpoint. Cognito, Auth0, Okta, Google, Azure AD, custom OIDC. Strongly recommended for production.
- **KMS via `internalKey`**: tokens signed in-house by an AWS KMS asymmetric key. Good when you control both signer and verifier and want the signing key in KMS for audit/rotation.
- **HMAC via `internalKey`**: webhook signatures (Stripe, GitHub, etc.), short-lived internal tokens inside a trust boundary you fully control. Avoid for cross-service auth — rotation is harder than asymmetric, and a leak from any verifier compromises every signer.

### Other notes for Cognito users

- Use `audience: COGNITO_CLIENT_ID` for **ID tokens**. **Access tokens** carry `client_id` instead of `aud`; either drop the `audience` check and validate `payload.client_id` in a follow-up middleware, or restrict the handler to one token type.
- Cognito tokens also carry a `token_use` claim (`id` or `access`). To enforce which type your handler accepts, add a small middleware after `http-jwt` that reads `request.internal.jwt.token_use` and throws `createError(401, ...)` on mismatch.

## Validating roles

`@middy/http-jwt` only verifies the signature and standard claims (`iss`, `aud`, `exp`, `nbf`). Role / scope / permission claims are application-specific and intentionally left to userland. The following inline middleware reads the decoded payload from `request.internal` (under `payloadKey`) and rejects the request when the required role is missing.

```javascript
import middy from '@middy/core'
import httpJwt from '@middy/http-jwt'
import httpErrorHandler from '@middy/http-error-handler'
import { createError } from '@middy/util'

const requireRole = (requiredRole, { payloadKey = 'jwt', claim = 'roles' } = {}) => ({
  before: (request) => {
    const payload = request.internal[payloadKey]
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

const lambdaHandler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}

export const handler = middy()
  .use(
    httpJwt({
      issuers: {
        [COGNITO_ISSUER]: { jwksUri: `${COGNITO_ISSUER}/.well-known/jwks.json`, audience: 'client' },
      },
      algorithm: 'RS256',
    }),
  )
  .use(requireRole('admin'))
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

Order matters: `requireRole` must run **after** `httpJwt` so the decoded payload is already on `request.internal`.

## Bundling

`jose` is a peer dependency. To keep it out of your Lambda bundle, add `jose` to your bundler's exclude list and provide it via a Lambda Layer.


## Pairs well with

- [`@middy/http-header-normalizer`](/docs/middlewares/http-header-normalizer) - normalize the `Authorization` header casing before this middleware reads it.
- [`@middy/kms`](/docs/middlewares/kms) - source the public key for JWT signature verification.
- [`@middy/http-error-handler`](/docs/middlewares/http-error-handler) - map the thrown 401 into a clean HTTP response.

## See also

- [`@middy/http-paseto`](/docs/middlewares/http-paseto) - same surface, PASETO v4.public tokens instead of JWT.
- [JWT authentication recipe](/docs/recipes/jwt-auth).

---
title: http-dpop
description: "Require a DPoP (RFC 9449) proof of possession for sender-constrained access tokens, so a stolen token is useless on its own."
status: alpha
---

Enforces [DPoP](https://www.rfc-editor.org/rfc/rfc9449), the OAuth mechanism that binds an access token to a key the client holds. A bound token is no longer a bearer token: every request must carry a fresh signature from that key, so a token lifted from a log, a proxy, or a settings field is worth nothing on its own.

This middleware runs **after** a token verifier. It reads the verified payload from `request.internal[payloadKey]`, takes the key thumbprint out of the `cnf` confirmation claim ([RFC 7800](https://www.rfc-editor.org/rfc/rfc7800)), and requires the request to prove possession of that key. Pair it with [`@middy/http-jwt`](/docs/middlewares/http-jwt) or [`@middy/http-paseto`](/docs/middlewares/http-paseto).

**Adoption is incremental by design.** A token with no `cnf.jkt` is an ordinary bearer token and passes straight through, so existing clients keep working with no change. A client opts in by sending a proof to your token endpoint; from then on its tokens are bound and this middleware enforces that. Set `required: true` once every client has moved.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-dpop
```

There is no peer dependency: verification uses `node:crypto` only.

## Options

- `payloadKey` (string) (default `jwt`): Key on `request.internal` holding the verified token payload. Set it to `paseto` when pairing with `@middy/http-paseto`, or to whatever `payloadKey` you configured on the verifier.
- `proofKey` (string) (default `dpop`): Key under which the verified proof claims are stored.
- `confirmationClaim` (string) (default `cnf`): Claim holding `{ jkt }`. Only change this if your authorization server puts the thumbprint somewhere non-standard.
- `origin` (string) (optional): The `https://host` the proof's `htu` must name. When omitted it is derived from `requestContext.domainName`, which API Gateway sets from the domain that served the request. Set it explicitly behind a CDN, a custom proxy, or an ALB.
- `algorithm` (string | string[]) (optional): Allowed proof algorithms. Defaults to all of `ES256`, `ES384`, `ES512`, `PS256`, `RS256`, `EdDSA`. Narrow it if you control every client.
- `maxAge` (number) (default `60`): How many seconds either side of now a proof's `iat` may fall.
- `maxProofLength` (number) (default `8192`): Longest `DPoP` header accepted, checked before anything parses it.
- `required` (boolean) (default `false`): When `true`, a token with no confirmation claim is rejected instead of passed through.
- `setToContext` (boolean) (default `false`): When `true`, the verified proof claims are also published to `request.context.middyContext[proofKey]`. There is no separate `contextKey`: `proofKey` names both.

NOTES:

- Every rejection is a `401 Unauthorized`. Pair with [`http-error-handler`](/docs/middlewares/http-error-handler) to turn it into a response.
- The `htu` is built from `origin` and the request path, **never** from the `Host` header. A client controls `Host`, so trusting it would let anyone mint a proof for an origin of their choosing.
- The `htu` comparison ignores the query string and fragment, per RFC 9449 §4.3, so a client does not have to reproduce your query serialization.
- Only asymmetric algorithms are accepted. `none` and the `HS*` family have no public half, so there is nothing a proof could demonstrate possession of.
- Each algorithm is pinned to the key type it must be paired with. Without that, `alg: "ES256"` carrying an RSA JWK would verify as RSA-SHA256 against a key the sender picked.

## Sample usage

### With `@middy/http-jwt`

```javascript
import middy from '@middy/core'
import httpJwt from '@middy/http-jwt'
import httpDpop from '@middy/http-dpop'
import httpErrorHandler from '@middy/http-error-handler'

const lambdaHandler = async (event) => {
  // The verified proof is on request.internal.dpop.
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}

export const handler = middy()
  .use(
    httpJwt({
      issuers: {
        'https://auth.example.com': {
          jwksUri: 'https://auth.example.com/.well-known/jwks.json',
          audience: 'https://api.example.com',
        },
      },
    }),
  )
  // After the verifier: only it can turn the token into the `cnf` claim.
  .use(httpDpop({ payloadKey: 'jwt' }))
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

### With `@middy/http-paseto`

```javascript
export const handler = middy()
  .use(kms({ fetchData: { pasetoKey: 'alias/paseto-signing-key' } }))
  .use(httpPaseto({ internalKey: 'pasetoKey', payloadKey: 'paseto' }))
  .use(httpDpop({ payloadKey: 'paseto', origin: 'https://api.example.com' }))
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

### Requiring a bound token

Once every client has adopted DPoP, close the door behind them:

```javascript
.use(httpDpop({ required: true }))
```

## What the client sends

A proof is a JWT signed with the client's own key. The public half travels in the header, so there is nothing to publish and nothing to register.

```json
// header
{
  "typ": "dpop+jwt",
  "alg": "ES256",
  "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
}
// payload
{
  "jti": "e1j3V_bK",
  "htm": "GET",
  "htu": "https://api.example.com/v1/things",
  "iat": 1772000000,
  "ath": "fUHyO2r2Z3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo"
}
```

`ath` is the base64url SHA-256 of the access token as presented. It pins the proof to one token, so a proof captured alongside one token cannot be paired with another.

The same shape, minus `ath`, is what a client sends to your token endpoint to get a bound token in the first place. That side is your authorization server's job, not this middleware's: put the thumbprint of the proof key into the token's `cnf.jkt` claim.

## Replay

This middleware does **not** keep a `jti` cache, and that is deliberate.

`ath` pins a proof to one token and `maxAge` bounds it to a minute, so replaying a proof requires an attacker who already holds both halves on the same channel, inside TLS. An in-process cache would not stop that attacker either, because a Lambda function runs many concurrent execution environments and a replay landing on a cold one still passes. Shipping one would trade a real dependency for the appearance of protection.

If your threat model needs it, the verified claims are published at `request.internal[proofKey]`, so a middleware of your own can check `jti` against a store you control:

```javascript
const dpopReplay = (table) => ({
  before: async (request) => {
    const { jti, iat } = request.internal.dpop ?? {}
    if (!jti) return // unbound token, nothing to check
    // Conditional put; throw a 401 if the jti already exists.
    await putOnce(table, jti, iat + 60)
  },
})

export const handler = middy()
  .use(httpJwt({ /* ... */ }))
  .use(httpDpop())
  .use(dpopReplay('dpop-jti'))
```

The stronger answer in the spec is the `DPoP-Nonce` flow (RFC 9449 §8), where the server controls freshness directly. It is not implemented here yet.

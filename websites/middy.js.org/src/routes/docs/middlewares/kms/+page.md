---
title: kms
description: "Fetch and cache AWS KMS asymmetric public keys for signature verification (JWT, PASETO, etc.)."
status: alpha
---

Fetches asymmetric public keys from [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) using `GetPublicKey` and exposes them via `request.internal` (and optionally `context.middyContext`). Designed to feed token-verification middleware such as [`@middy/http-jwt`](/docs/middlewares/http-jwt) and [`@middy/http-paseto`](/docs/middlewares/http-paseto), but the resolved `{ publicKey, keySpec }` shape can be consumed by any custom middleware.

For each `fetchData` entry the middleware makes a single `GetPublicKey` API call per cold start, caches the result, and stores `{ publicKey, keySpec }` under the configured internal key.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/kms
npm install --save-dev @aws-sdk/client-kms
```

## Options

- `AwsClient` (object) (default `KMSClient`): KMSClient class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-kms`.
- `awsClientOptions` (object) (optional): Options to pass to KMSClient class constructor.
- `awsClientAssumeRole` (string) (optional): Internal key where temporary credentials are stored. See [@middy/sts](/docs/middlewares/sts) on how to set this. With it set, cached entries are not refreshed in the background (a refresh has no invocation to take fresh credentials from); an expired entry is refetched by the next invocation. It fails the invocation with `Credentials missing for assumed role` when the credentials are not in `request.internal` (a mistyped key, or `@middy/sts` registered after this middleware), rather than falling back to the function's own role; register `sts` first.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to KMS `KeyId` (key ID, key ARN, alias name, or alias ARN, e.g. `alias/jwt-signing-key`).
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `@middy/kms`): Cache key for the fetched data responses. Each instance of this middleware needs its own `cacheKey`: reusing one with a different `fetchData`, `awsClientOptions`, `awsClientAssumeRole` or `AwsClient` throws a `TypeError`.
- `cacheKeyExpiry` (object) (default `{}`): Per-`cacheKey` expiry override, `{ [cacheKey]: cacheExpiry }`; a unix timestamp in ms above 86400000 is treated as an absolute expiry.
- `cacheMaxSize` (number) (default `128`): Maximum number of entries kept in the shared middleware cache; the oldest expiring entry is evicted when exceeded.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. KMS public keys do not rotate without an explicit `CreateKey`, so the default of "cache forever" is appropriate for most deployments. Values above `86400000` are unix timestamps (ms): one before 2001-01-01 (`978307200000`) can only be a mistyped duration and throws at construction, while a real timestamp that has passed just leaves the entry expired.
- `setToContext` (boolean) (default `false`): Also publish each `fetchData` entry to `context.middyContext.kms`.
- `contextKey` (string) (default `kms`): The key under `context.middyContext` used when `setToContext` is `true`. To run two instances side by side, override it and set a distinct `cacheKey` on each.

NOTES:

- Lambda is required to have IAM permission for `kms:GetPublicKey` on each KMS key referenced in `fetchData`.
- Each internal value has the shape `{ publicKey: Uint8Array, keySpec: string }`. `publicKey` is the SPKI DER-encoded public key returned by KMS; `keySpec` is the KMS key spec (e.g. `RSA_2048`, `ECC_NIST_P256`, `ECC_NIST_ED25519`).

## Sample usage

### Verifying JWTs signed by a KMS key

```javascript
import middy from '@middy/core'
import kms from '@middy/kms'
import httpJwt from '@middy/http-jwt'
import httpErrorHandler from '@middy/http-error-handler'

const lambdaHandler = (event, context) => {
  // `jwt` is @middy/http-jwt's payloadKey under context.middyContext
  const { sub } = context.middyContext.jwt
  return { statusCode: 200, body: JSON.stringify({ sub }) }
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
      algorithm: 'RS256', // sign with typ: 'at+jwt', the default expected typ
      issuer: 'https://auth.example.com',
      audience: 'api.example.com',
      setToContext: true,
    }),
  )
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

### Verifying PASETO v4.public tokens

```javascript
import middy from '@middy/core'
import kms from '@middy/kms'
import httpPaseto from '@middy/http-paseto'

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
    }),
  )
  .handler(async () => ({ statusCode: 200, body: '{}' }))
```

### Reading the public key directly

```javascript
import middy from '@middy/core'
import kms from '@middy/kms'
import { createPublicKey } from 'node:crypto'

const lambdaHandler = async (event, context) => {
  const { signingKey } = context.middyContext.kms
  // signingKey is { publicKey: Uint8Array, keySpec: 'RSA_2048' | ... }
  const key = createPublicKey({
    key: Buffer.from(signingKey.publicKey),
    format: 'der',
    type: 'spki',
  })
  // ... verify a signature with `key`
  return { statusCode: 200, body: '{}' }
}

export const handler = middy()
  .use(
    kms({
      fetchData: { signingKey: 'alias/my-app' },
      setToContext: true,
    }),
  )
  .handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-kms` to the exclude list.

---
title: rds-signer
description: "Generate RDS IAM authentication tokens for secure database connections in Lambda."
---

Fetches RDS credentials to be used when connecting to RDS with IAM roles.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/rds-signer
npm install --save-dev @aws-sdk/rds-signer
```

## Options

- `AwsClient` (object) (default `Signer`): Signer class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/rds-signer`.
- `awsClientOptions` (object) (optional): Options to pass to Signer class constructor.
- `fetchData` (object) (required): Mapping of internal key name to API request parameters.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can.
- `cacheKey` (string) (default `@middy/rds-signer`): Cache key for the fetched data responses. Each instance of this middleware needs its own `cacheKey`: reusing one with a different `fetchData`, `awsClientOptions` or `AwsClient` throws a `TypeError`.
- `cacheKeyExpiry` (object) (default `{}`): Per-`cacheKey` expiry override, `{ [cacheKey]: cacheExpiry }`; a unix timestamp in ms above 86400000 is treated as an absolute expiry.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. IAM auth tokens are valid for 15 minutes, so a token is refreshed 14 minutes after issue regardless of a longer setting. Values above `86400000` are unix timestamps (ms): one before 2001-01-01 (`978307200000`) can only be a mistyped duration and throws at construction, while a real timestamp that has passed just leaves the entry expired.
- `cacheMaxSize` (number) (default `128`): Maximum number of entries kept in the shared middleware cache; the oldest expiring entry is evicted when exceeded.
- `setToContext` (boolean) (default `false`): Also publish each `fetchData` entry to `context.middyContext['rds-signer']`.
- `contextKey` (string) (default `rds-signer`): The key under `context.middyContext` used when `setToContext` is `true`. To run two instances side by side, override it and set a distinct `cacheKey` on each.

NOTES:

- Lambda is required to have IAM permission for `rds-db:connect` with a resource like `arn:aws:rds-db:#{AWS::Region}:#{AWS::AccountId}:dbuser:${database_resource}/${iam_role}`

## Sample usage

```javascript
import middy from '@middy/core'
import rdsSigner from '@middy/rds-signer'

const lambdaHandler = (event, context) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }

  return response
}

export const handler = middy()
  .use(
    rdsSigner({
      fetchData: {
        rdsToken: {
          region: 'ca-central-1',
          hostname: '***.rds.amazonaws.com',
          username: 'iam_role',
          port: 5432
        }
      }
    })
  )
  .handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/rds-signer` to the exclude list.

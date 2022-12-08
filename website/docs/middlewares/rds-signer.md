---
title: rds-signer
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
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `rds-signer`): Cache key for the fetched data responses. Must be unique across all middleware.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToContext` (boolean) (default `false`): Store role tokens to `request.context`.

NOTES:

- Lambda is required to have IAM permission for `rds-db:connect` with a resource like `arn:aws:rds-db:#{AWS::Region}:#{AWS::AccountId}:dbuser:${database_resource}/${iam_role}`

## Sample usage

```javascript
import middy from '@middy/core'
import rdsSigner from '@middy/rds-signer'

const handler = middy((event, context) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }

  return response
})

handler.use(
  rdsSigner({
    fetchData: {
      rdsToken: {
        region: 'ca-central-1',
        hostname: '***.rds.amazonaws.com',
        username: 'iam_role',
        database: 'postgres',
        port: 5432
      }
    }
  })
)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/rds-signer` to the exclude list.

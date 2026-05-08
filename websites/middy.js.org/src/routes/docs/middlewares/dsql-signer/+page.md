---
title: dsql-signer
description: "Generate Aurora DSQL IAM authentication tokens for secure database connections in Lambda."
---

Fetches Aurora DSQL credentials to be used when connecting to a DSQL cluster with IAM roles.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/dsql-signer
npm install --save-dev @aws-sdk/dsql-signer
```

## Options

- `AwsClient` (object) (default `DsqlSigner`): Signer class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/dsql-signer`.
- `awsClientOptions` (object) (optional): Options to pass to Signer class constructor.
- `fetchData` (object) (required): Mapping of internal key name to API request parameters.
  - `hostname` (string) (required): DSQL cluster endpoint, e.g. `<cluster-id>.dsql.<region>.on.aws`. Validated against the DSQL hostname format.
  - `username` (string) (optional): Database role. When set to `"admin"` the middleware calls `getDbConnectAdminAuthToken`; any other value (or omitted) calls `getDbConnectAuthToken`.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can.
- `cacheKey` (string) (default `dsql-signer`): Cache key for the fetched data responses. Must be unique across all middleware.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. Note: DSQL tokens have a default TTL of 900 s; cache for less than that to avoid using expired tokens on warm invocations.
- `setToContext` (boolean) (default `false`): Store role tokens to `request.context`.

NOTES:

- Lambda is required to have IAM permission for `dsql:DbConnect` (non-admin role) or `dsql:DbConnectAdmin` (admin role) on the cluster ARN.
- DSQL connections always use port `5432`, database `postgres`, and require SSL.
- Region is taken from the default credential provider chain (e.g. `AWS_REGION`); cross-region access is not a supported DSQL pattern.

## Sample usage

```javascript
import middy from '@middy/core'
import dsqlSigner from '@middy/dsql-signer'
import { getInternal } from '@middy/util'
import pg from 'pg'

const lambdaHandler = async (event, context) => {
  const { dsqlToken } = await getInternal(['dsqlToken'], context)

  const client = new pg.Client({
    host: 'cluster-id.dsql.us-east-1.on.aws',
    port: 5432,
    database: 'postgres',
    user: 'admin',
    password: dsqlToken,
    ssl: true
  })
  await client.connect()

  const { rows } = await client.query('SELECT 1')
  await client.end()

  return {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ rows })
  }
}

export const handler = middy()
  .use(
    dsqlSigner({
      fetchData: {
        dsqlToken: {
          hostname: 'cluster-id.dsql.us-east-1.on.aws',
          username: 'admin'
        }
      }
    })
  )
  .handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/dsql-signer` to the exclude list.

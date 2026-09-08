---
title: dsql-signer
description: "Generate Aurora DSQL IAM authentication tokens for secure database connections in Lambda."
status: alpha
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
- `cacheKeyExpiry` (object) (default `{}`): Per-`cacheKey` expiry override, `{ [cacheKey]: cacheExpiry }`; a unix timestamp in ms above 86400000 is treated as an absolute expiry.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. A DSQL authentication token [automatically expires in 15 minutes by default](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html) (`awsClientOptions.expiresIn` seconds, `900` by default, up to a maximum of `604800`), so a token is refreshed one minute before it expires, 14 minutes after issue by default, regardless of a longer setting. With an `expiresIn` of `60` or less that margin leaves no lifetime, so the token is not cached and a fresh one is signed on every invocation.
- `setToContext` (boolean) (default `false`): Also publish each `fetchData` entry to `context.middyContext['dsql-signer']`.
- `contextKey` (string) (default `dsql-signer`): The key under `context.middyContext` used when `setToContext` is `true`. Override it to run two instances side by side.

NOTES:

- Lambda is required to have IAM permission for `dsql:DbConnect` (non-admin role) or `dsql:DbConnectAdmin` (admin role) on the cluster ARN.
- DSQL connections always use port `5432`, database `postgres`, and require SSL.
- The token only authenticates the connection: [after the connection is established, the connection remains valid even if the authentication token expires](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html).
- Region is taken from the default credential provider chain (e.g. `AWS_REGION`); cross-region access is not a supported DSQL pattern.

## Sample usage

### With @middy/dsql (recommended)

```javascript
import middy from '@middy/core'
import dsqlSigner from '@middy/dsql-signer'
import dsql from '@middy/dsql'
import clientPgPool from '@middy/dsql/clientPgPool'

export const handler = middy()
  .use(
    dsqlSigner({
      fetchData: {
        dsqlToken: {
          hostname: 'cluster-id.dsql.us-east-1.on.aws',
          username: 'admin',
        },
      },
    }),
  )
  .use(
    dsql({
      client: clientPgPool,
      config: {
        host: 'cluster-id.dsql.us-east-1.on.aws',
        username: 'admin',
        database: 'postgres',
      },
      internalKey: 'dsqlToken',
    }),
  )
  .handler(async (event, context) => {
    const { rows } = await context.middyContext.dsql.query('SELECT 1')
    return { statusCode: 200, body: JSON.stringify({ rows }) }
  })
```

### Manual (advanced)

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
    ssl: true,
  })
  await client.connect()
  const { rows } = await client.query('SELECT 1')
  await client.end()

  return { statusCode: 200, body: JSON.stringify({ rows }) }
}

export const handler = middy()
  .use(
    dsqlSigner({
      fetchData: {
        dsqlToken: {
          hostname: 'cluster-id.dsql.us-east-1.on.aws',
          username: 'admin',
        },
      },
    }),
  )
  .handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/dsql-signer` to the exclude list.

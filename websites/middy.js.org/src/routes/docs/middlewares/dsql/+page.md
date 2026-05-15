---
title: dsql
description: "Connect Lambda handlers to Amazon Aurora DSQL using plain pg or postgres.js with IAM auth tokens from @middy/dsql-signer."
status: alpha
---

Attaches an Aurora DSQL connection (`pg.Client`, `pg.Pool`, or `postgres.js` `sql`) to `request.context` using plain PostgreSQL drivers. Pair with `@middy/dsql-signer` to generate IAM auth tokens; the token is injected as the connection password via `internalKey`.

## Install

Pick the adapter that matches your driver. Each adapter is a separate subpath import so unused drivers stay out of the bundle.

```bash npm2yarn
# pg.Client (single connection)
npm install --save @middy/dsql @middy/dsql-signer pg

# pg.Pool (connection pool, recommended for Lambda)
npm install --save @middy/dsql @middy/dsql-signer pg

# postgres.js
npm install --save @middy/dsql @middy/dsql-signer postgres
```

## Options

- `client` (function) (required): Adapter function `(config) => client | Promise<client>`. Use one of the bundled adapters: `@middy/dsql/clientPg`, `@middy/dsql/clientPgPool`, or `@middy/dsql/clientPostgres`.
- `config` (object) (required): Connection config. Must include `host`. Standard fields: `username`, `database`, `port`. Anything extra is forwarded to the underlying driver. `ssl` defaults to `true` and can be overridden.
- `contextKey` (string) (default `dsql`): Key on `request.context` where the client is attached.
- `internalKey` (string) (optional): Key in `request.internal` holding the auth token from `@middy/dsql-signer`. When set, the token is merged as `password` into the connection config. Prefetch is disabled when this is set.
- `disablePrefetch` (boolean) (default `false`): On cold start, requests will trigger early if they can. Ignored when `internalKey` is set.
- `cacheKey` (string) (default `@middy/dsql`): Cache key for the instantiated client. Must be unique across middleware.
- `cacheKeyExpiry` (object) (default `{}`): Per-key cache expiry overrides.
- `cacheExpiry` (number) (default `-1`): How long the client should be cached for. `-1`: cache forever (recommended for connection pooling), `0`: never cache (calls `client.end()` on `after` / `onError`), `n`: cache for n ms.

NOTES:

- Lambda is required to have IAM permission for `dsql:DbConnect` (or `dsql:DbConnectAdmin` if `username` is `admin`) on the cluster ARN.
- DSQL clusters listen on port `5432` and require TLS. `ssl: true` is applied by default.
- Token TTL and caching should be configured on `@middy/dsql-signer` (default DSQL token TTL is 900 s).

## Sample usage

### pg.Pool

```javascript
import middy from '@middy/core'
import dsqlSigner from '@middy/dsql-signer'
import dsql from '@middy/dsql'
import clientPgPool from '@middy/dsql/clientPgPool'

const lambdaHandler = async (event, context) => {
  const { rows } = await context.dsql.query('SELECT now()')
  return { statusCode: 200, body: JSON.stringify(rows) }
}

export const handler = middy()
  .use(
    dsqlSigner({
      fetchData: {
        dsqlToken: {
          hostname: 'cluster.dsql.us-east-1.on.aws',
          username: 'admin',
        },
      },
      cacheExpiry: 14 * 60 * 1000,
    }),
  )
  .use(
    dsql({
      client: clientPgPool,
      config: {
        host: 'cluster.dsql.us-east-1.on.aws',
        username: 'admin',
        database: 'postgres',
      },
      internalKey: 'dsqlToken',
    }),
  )
  .handler(lambdaHandler)
```

### pg.Client

```javascript
import middy from '@middy/core'
import dsqlSigner from '@middy/dsql-signer'
import dsql from '@middy/dsql'
import clientPg from '@middy/dsql/clientPg'

export const handler = middy()
  .use(
    dsqlSigner({
      fetchData: {
        dsqlToken: { hostname: 'cluster.dsql.us-east-1.on.aws', username: 'admin' },
      },
      cacheExpiry: 14 * 60 * 1000,
    }),
  )
  .use(
    dsql({
      client: clientPg,
      config: { host: 'cluster.dsql.us-east-1.on.aws', username: 'admin' },
      internalKey: 'dsqlToken',
      cacheExpiry: 0,
    }),
  )
  .handler(async (event, context) => {
    const { rows } = await context.dsql.query('SELECT now()')
    return rows
  })
```

### postgres.js

```javascript
import middy from '@middy/core'
import dsqlSigner from '@middy/dsql-signer'
import dsql from '@middy/dsql'
import clientPostgres from '@middy/dsql/clientPostgres'

export const handler = middy()
  .use(
    dsqlSigner({
      fetchData: {
        dsqlToken: { hostname: 'cluster.dsql.us-east-1.on.aws', username: 'admin' },
      },
      cacheExpiry: 14 * 60 * 1000,
    }),
  )
  .use(
    dsql({
      client: clientPostgres,
      config: { host: 'cluster.dsql.us-east-1.on.aws', username: 'admin' },
      internalKey: 'dsqlToken',
    }),
  )
  .handler(async (event, context) => {
    return context.dsql`SELECT now()`
  })
```

## Bundling

To exclude PostgreSQL drivers from your Lambda bundle, add `pg` and/or `postgres` to your bundler's exclude list (only the ones matching the adapter you import). Add `@aws-sdk/dsql-signer` to exclude the signer SDK.

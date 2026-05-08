---
title: dsql
description: "Connect Lambda handlers to Amazon Aurora DSQL using AWS Labs' connectors with built-in IAM auth and token refresh."
---

Attaches an Aurora DSQL connection (`pg.Client`, `pg.Pool`, or `postgres.js` `sql`) to `request.context` using the official AWS Labs DSQL connectors. The connectors handle IAM auth and token rotation internally, so this middleware does **not** need `@middy/dsql-signer` or any external signer.

## Install

Pick the adapter that matches your driver. Each adapter is a separate subpath import so unused connectors stay out of the bundle.

```bash npm2yarn
# pg.Client (single connection)
npm install --save @middy/dsql @aws/aurora-dsql-node-postgres-connector pg

# pg.Pool (connection pool, recommended for Lambda)
npm install --save @middy/dsql @aws/aurora-dsql-node-postgres-connector pg

# postgres.js
npm install --save @middy/dsql @aws/aurora-dsql-postgresjs-connector postgres
```

## Options

- `client` (function) (required): Adapter function `(config) => client | Promise<client>`. Use one of the bundled adapters: `@middy/dsql/clientPg`, `@middy/dsql/clientPgPool`, or `@middy/dsql/clientPostgres`.
- `config` (object) (required): Connector config. Must include `host`. Standard fields: `username`, `database`, `region`, `port`, `tokenDurationSecs`. Anything extra is forwarded to the underlying client.
- `contextKey` (string) (default `dsql`): Key on `request.context` where the client is attached.
- `disablePrefetch` (boolean) (default `false`): On cold start, requests will trigger early if they can.
- `cacheKey` (string) (default `@middy/dsql`): Cache key for the instantiated client. Must be unique across middleware.
- `cacheKeyExpiry` (object) (default `{}`): Per-key cache expiry overrides.
- `cacheExpiry` (number) (default `-1`): How long the client should be cached for. `-1`: cache forever (recommended; the connectors refresh tokens internally), `0`: never cache (calls `client.end()` on `after` / `onError`), `n`: cache for n ms.

NOTES:

- Lambda is required to have IAM permission for `dsql:DbConnect` (or `dsql:DbConnectAdmin` if `username` is `admin`) on the cluster ARN.
- DSQL clusters listen on `5432` and require TLS; the connectors handle SSL automatically.

## Sample usage

### pg.Pool

```javascript
import middy from '@middy/core'
import dsql from '@middy/dsql'
import clientPgPool from '@middy/dsql/clientPgPool'

const lambdaHandler = async (event, context) => {
  const { rows } = await context.dsql.query('SELECT now()')
  return { statusCode: 200, body: JSON.stringify(rows) }
}

export const handler = middy()
  .use(
    dsql({
      client: clientPgPool,
      config: {
        host: 'cluster.dsql.us-east-1.on.aws',
        username: 'admin',
        database: 'postgres',
      },
    }),
  )
  .handler(lambdaHandler)
```

### pg.Client

```javascript
import middy from '@middy/core'
import dsql from '@middy/dsql'
import clientPg from '@middy/dsql/clientPg'

export const handler = middy()
  .use(
    dsql({
      client: clientPg,
      config: { host: 'cluster.dsql.us-east-1.on.aws', username: 'admin' },
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
import dsql from '@middy/dsql'
import clientPostgres from '@middy/dsql/clientPostgres'

export const handler = middy()
  .use(
    dsql({
      client: clientPostgres,
      config: { host: 'cluster.dsql.us-east-1.on.aws', username: 'admin' },
    }),
  )
  .handler(async (event, context) => {
    return context.dsql`SELECT now()`
  })
```

## Bundling

To exclude the AWS connectors and PostgreSQL drivers from your Lambda bundle, add `@aws/aurora-dsql-node-postgres-connector`, `@aws/aurora-dsql-postgresjs-connector`, `pg`, and/or `postgres` to your bundler's exclude list (only the ones matching the adapter you import).

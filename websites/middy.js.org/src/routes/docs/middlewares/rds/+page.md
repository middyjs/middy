---
title: rds
description: "Manage RDS connection lifecycle in Lambda with connection pooling, IAM token injection, and TLS certificate support."
---

Manages an RDS (or Aurora) database connection for each Lambda invocation, injecting it into `request.context`. Supports `pg.Client`, `pg.Pool`, and `postgres.js` via interchangeable client adapters. Pairs with `@middy/rds-signer` for IAM token authentication.

## Install

Pick the adapter that matches your driver:

```bash npm2yarn
# pg.Client
npm install --save @middy/rds pg

# pg.Pool
npm install --save @middy/rds pg

# postgres.js
npm install --save @middy/rds postgres
```

## Options

- `client` (function) (required): Client adapter factory. Import from `@middy/rds/clientPg`, `@middy/rds/clientPgPool`, or `@middy/rds/clientPostgres`.
- `config` (object) (required): Connection configuration passed to the client adapter.
  - `host` (string) (required): Database hostname.
  - `username` (string) (optional): Database user.
  - `database` (string) (optional): Database name.
  - `port` (integer) (optional): Database port.
  - Additional driver-specific options are passed through.
- `contextKey` (string) (default `rds`): Key under which the connection is stored on `request.context`.
- `internalKey` (string) (optional): Internal key holding the IAM token from `@middy/rds-signer` or `@middy/dsql-signer`. When set, the resolved token is merged into `config.password` before the client is built.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Automatically disabled when `internalKey` is set.
- `cacheKey` (string) (default `@middy/rds`): Cache key for the connection. Must be unique across all middleware.
- `cacheExpiry` (number) (default `-1`): How long to reuse the connection. `-1`: reuse forever, `0`: close after each invocation, `n`: reuse for n ms.

## Secure connections (TLS)

RDS requires TLS. Two approaches for supplying the CA bundle:

### Per-region import (recommended)

Run `npm run certificates` once to download [per-region AWS RDS CA bundles](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html#UsingWithRDS.SSL.CertificatesAllRegions) into `certificates/<region>.js`. Only your region's bundle ships with the function, keeping the deployment size small.

```javascript
import rds from '@middy/rds'
import clientPgPool from '@middy/rds/clientPgPool'
import ca from '@middy/rds/certificates/us-east-1'

export const handler = middy()
  .use(
    rds({
      client: clientPgPool,
      config: {
        host: 'db.cluster-id.us-east-1.rds.amazonaws.com',
        ssl: { rejectUnauthorized: true, ca },
      },
    })
  )
  .handler(lambdaHandler)
```

### NODE_EXTRA_CA_CERTS

Add the AWS global bundle to your container image and point `NODE_EXTRA_CA_CERTS` at it. `@middy/rds/ca` reads the file at cold-start time.

```dockerfile
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /var/task/global-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/var/task/global-bundle.pem
```

```javascript
import rds from '@middy/rds'
import clientPgPool from '@middy/rds/clientPgPool'
import ca from '@middy/rds/ca'

export const handler = middy()
  .use(
    rds({
      client: clientPgPool,
      config: {
        host: 'db.cluster-id.us-east-1.rds.amazonaws.com',
        ssl: { rejectUnauthorized: true, ca: ca() },
      },
    })
  )
  .handler(lambdaHandler)
```

`ca()` throws if `NODE_EXTRA_CA_CERTS` is not set, so misconfiguration surfaces at cold start rather than silently skipping certificate verification.

## Sample usage

With IAM token authentication via `@middy/rds-signer`:

```javascript
import middy from '@middy/core'
import rdsSigner from '@middy/rds-signer'
import rds from '@middy/rds'
import clientPgPool from '@middy/rds/clientPgPool'
import ca from '@middy/rds/certificates/us-east-1'

const lambdaHandler = async (event, context) => {
  const pool = context.rds
  const { rows } = await pool.query('SELECT 1')

  return {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ rows }),
  }
}

export const handler = middy()
  .use(
    rdsSigner({
      fetchData: {
        rdsToken: {
          region: 'us-east-1',
          hostname: 'db.cluster-id.us-east-1.rds.amazonaws.com',
          username: 'iam_role',
          port: 5432,
        },
      },
    })
  )
  .use(
    rds({
      client: clientPgPool,
      internalKey: 'rdsToken',
      config: {
        host: 'db.cluster-id.us-east-1.rds.amazonaws.com',
        user: 'iam_role',
        database: 'mydb',
        port: 5432,
        ssl: { rejectUnauthorized: true, ca },
      },
    })
  )
  .handler(lambdaHandler)
```

NOTES:

- `@middy/rds-signer` must be listed before `@middy/rds` so the token is available in `request.internal` when the connection is built.
- Lambda is required to have IAM permission for `rds-db:connect` on the database user ARN.
- Set the RDS parameter group to enforce TLS (`rds.force_ssl = 1` for PostgreSQL).

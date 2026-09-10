---
title: rds
description: "Manage RDS connection lifecycle in Lambda with connection pooling, IAM token injection, and TLS certificate support."
status: alpha
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
  - `user` (string) (optional): Database user for the `pg` adapters (`clientPg`, `clientPgPool`). `username` is accepted as well and mapped to `user`.
  - `username` (string) (optional): Database user for the `postgres.js` adapter (`clientPostgres`).
  - `database` (string) (optional): Database name.
  - `port` (integer) (optional): Database port.
  - Additional driver-specific options are passed through.
- `contextKey` (string) (default `rds`): Key under `context.middyContext` where the connection is published.
- `internalKey` (string) (optional): Internal key holding the IAM token from `@middy/rds-signer` or `@middy/dsql-signer`. When set, the resolved token is merged into `config.password` before the client is built. With a positive `cacheExpiry` the connection is not refreshed in the background, since that could only replay the token of the invocation that opened it; the entry expires and the next invocation reconnects with its own token.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Automatically disabled when `internalKey` is set.
- `cacheKey` (string) (default `@middy/rds`): Cache key for the connection. Must be unique across all middleware.
- `cacheKeyExpiry` (object) (default `{}`): Per-`cacheKey` expiry override, `{ [cacheKey]: cacheExpiry }`; a unix timestamp in ms above 86400000 is treated as an absolute expiry. The override replaces `cacheExpiry` entirely, including whether the connection is closed after each invocation.
- `cacheExpiry` (number) (default `-1`): How long to reuse the connection. `-1`: reuse forever, `0`: close after each invocation, `n`: reuse for n ms. A connection replaced by a refresh, or flagged broken by the adapter, is closed once the invocations using it finish; newer connections stay open.

## Secure connections (TLS)

RDS requires TLS. Use `@middy/rds/ssl` to build the SSL config. It sets `rejectUnauthorized: true` and passes your CA bundle through, so the driver verifies the server certificate against the AWS RDS CA and checks the hostname with Node's default `tls` identity check. It does not set `sslmode`; the driver's `ssl` object is what turns TLS on. Spread the result into your client config.

`ssl(ca, options)` accepts:

- `servername` (string) (optional): Hostname the server certificate is verified against, also sent as the TLS SNI name. Set it to the real RDS endpoint when `host` is a CNAME (see [Connecting through a CNAME](#connecting-through-a-cname)).

### Per-region import (recommended)

Import your region's subpath, `@middy/rds/certificates/<region>`, which carries that region's [AWS RDS CA bundle](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html#UsingWithRDS.SSL.CertificatesAllRegions) (`global` is the all-region bundle). Only your region's bundle ships with the function, keeping the deployment size small. Each subpath is typed as a `string`.

```javascript
import rds from '@middy/rds'
import clientPgPool from '@middy/rds/clientPgPool'
import ssl from '@middy/rds/ssl'
import ca from '@middy/rds/certificates/us-east-1'

export const handler = middy()
  .use(
    rds({
      client: clientPgPool,
      config: {
        host: 'db.cluster-id.us-east-1.rds.amazonaws.com',
        ...ssl(ca),
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
import ssl from '@middy/rds/ssl'
import getCa from '@middy/rds/ca'

export const handler = middy()
  .use(
    rds({
      client: clientPgPool,
      config: {
        host: 'db.cluster-id.us-east-1.rds.amazonaws.com',
        ...ssl(getCa()),
      },
    })
  )
  .handler(lambdaHandler)
```

`getCa()` throws if `NODE_EXTRA_CA_CERTS` is not set, so misconfiguration surfaces at cold start rather than silently skipping certificate verification.

### Connecting through a CNAME

RDS certificates are issued for the instance or cluster endpoint, not for a DNS alias you point at it. If `host` is a CNAME such as `db.example.com`, hostname verification fails because the certificate does not name it. Pass `servername` with the real RDS endpoint so the certificate is checked against that name. Node's `tls` also sends it as the SNI name, and the socket still connects to `host`. `pg` replaces `servername` with `host` after merging the ssl object, so `ssl()` also sets `checkServerIdentity` bound to `servername`; with either driver the certificate is verified only against the endpoint you configured, never against the alias.

```javascript
import rds from '@middy/rds'
import clientPgPool from '@middy/rds/clientPgPool'
import ssl from '@middy/rds/ssl'
import ca from '@middy/rds/certificates/us-east-1'

export const handler = middy()
  .use(
    rds({
      client: clientPgPool,
      config: {
        host: 'db.example.com',
        ...ssl(ca, {
          servername: 'db.cluster-id.us-east-1.rds.amazonaws.com',
        }),
      },
    })
  )
  .handler(lambdaHandler)
```

A certificate for any other RDS endpoint, including one in the same region, is rejected. Do not work around a hostname error by setting `rejectUnauthorized: false` or by overriding `checkServerIdentity`; that would accept any certificate the CA has issued.

## Sample usage

With IAM token authentication via `@middy/rds-signer`:

```javascript
import middy from '@middy/core'
import rdsSigner from '@middy/rds-signer'
import rds from '@middy/rds'
import clientPgPool from '@middy/rds/clientPgPool'
import ssl from '@middy/rds/ssl'
import ca from '@middy/rds/certificates/us-east-1'

const lambdaHandler = async (event, context) => {
  const pool = context.middyContext.rds
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
        ...ssl(ca),
      },
    })
  )
  .handler(lambdaHandler)
```

NOTES:

- `@middy/rds-signer` must be listed before `@middy/rds` so the token is available in `request.internal` when the connection is built.
- Lambda is required to have IAM permission for `rds-db:connect` on the database user ARN.
- Set the RDS parameter group to enforce TLS (`rds.force_ssl = 1` for PostgreSQL).
- Under `@middy/core/executionModeDurableContext` a handler that throws does not run `onError`, so the connection that invocation held is released at the next durable invocation on the same execution environment instead (and, with `cacheExpiry: 0`, closed then).

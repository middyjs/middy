---
title: AWS Relational Database Service (RDS)
description: "Connect to AWS RDS from Lambda using Middy with IAM authentication and connection pooling."
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

First, you need to pass in a password. In order from most secure to least: `RDS.Signer`, `SecretsManager`, `SSM` using SecureString.
`SSM` can be considered equally secure to `SecretsManager` if you have your own password rotation system.

Additionally, you will want to verify the RDS certificate and the domain of your connection. `@middy/rds/ssl` handles this: it sets `rejectUnauthorized: true` and bundles your CA, and leaves hostname verification to Node's `tls` defaults. When you connect through a CNAME, pass `servername` so the certificate is checked against the real RDS endpoint.

```javascript
import ssl from '@middy/rds/ssl'
import ca from '@middy/rds/certificates/us-east-1'

// spread into your client config
const connectionOptions = {
  host: 'db.cluster-id.us-east-1.rds.amazonaws.com',
  ...ssl(ca),
}

// connecting through a CNAME
const cnameConnectionOptions = {
  host: 'db.example.com',
  ...ssl(ca, { servername: 'db.cluster-id.us-east-1.rds.amazonaws.com' }),
}
```

Corresponding `RDS.ParameterGroups` values should be set to enforce TLS connections.

---
title: AWS Relational Database Service (RDS)
---

:::caution

This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.

:::

First, you need to pass in a password. In order from most secure to least: `RDS.Signer`, `SecretsManager`, `SSM` using SecureString.
`SSM` can be considered equally secure to `SecretsManager` if you have your own password rotation system.

Additionally, you will want to verify the RDS certificate and the domain of your connection. You can use this sudo code to get you started:

```javascript
import tls from 'tls'

// https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
// TODO test pulling from ENV process.env.NODE_EXTRA_CA_CERTS
const ca = `-----BEGIN CERTIFICATE----- ...` 

connectionOptions = {
  ...,
  ssl: {
    rejectUnauthorized: true,
      ca,
      checkServerIdentity: (host, cert) => {
      const error = tls.checkServerIdentity(host, cert)
      if (
        error &&
        !cert.subject.CN.endsWith('.rds.amazonaws.com')
      ) {
        return error
      }
    }
  }
}
```

Corresponding `RDS.ParameterGroups` values should be set to enforce TLS connections.

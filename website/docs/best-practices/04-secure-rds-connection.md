---
title: Connecting to RDS securely
sidebar_position: 4
---

First, you need to pass in a password. In order from most secure to least: `RDS.Signer`, `SecretsManager`, `SSM` using SecureString.
`SSM` can be considered equally secure to `SecretsManager` if you have your own password rotation system.

Additionally, you will want to verify the RDS certificate and the domain of your connection. You can use this sudo code to get you started:

```javascript
import tls from 'tls'

// https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
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

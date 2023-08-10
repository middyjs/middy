---
title: secrets-manager
---

This middleware fetches secrets from [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).

Secrets to fetch can be defined by by name. See AWS docs [here](https://docs.aws.amazon.com/secretsmanager/latest/userguide/tutorials_basic.html).

Secrets are assigned to the function handler's `context` object.

The Middleware makes a single [API request](https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html) for each secret as Secrets Manager does not support batch get.

For each secret, you also provide the name under which its value should be added to `context`.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/secrets-manager
npm install --save-dev @aws-sdk/client-secrets-manager
```

## Options

- `AwsClient` (object) (default `SecretsManagerClient`): SecretsManagerClient class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-secrets-manager`.
- `awsClientOptions` (object) (optional): Options to pass to SecretsManagerClient class constructor.
- `awsClientAssumeRole` (string) (optional): Internal key where secrets are stored. See [@middy/sts](/docs/middlewares/sts) on to set this.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to API request parameter `SecretId`.
- `fetchRotationDate` (boolean|object) (default `false`): Boolean to apply to all or mapping of internal key name to boolean. This indicates what secrets should fetch and cached based on `NextRotationDate`/`LastRotationDate`/`LastChangedDate`. `cacheExpiry` of `-1` will use `NextRotationDate`, while any other value will be added to the `LastRotationDate` or `LastChangedDate`, whichever is more recent. If secrets have different rotation schedules, use multiple instances of this middleware.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `secrets-manager`): Cache key for the fetched data responses. Must be unique across all middleware.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToContext` (boolean) (default `false`): Store secrets to `request.context`.

NOTES:

- Lambda is required to have IAM permission for `secretsmanager:GetSecretValue`. If using `fetchRotationDate` add `secretsmanager:DescribeSecret` in as well.

## Sample usage

```javascript
import middy from '@middy/core'
import secretsManager from '@middy/secrets-manager'

const handler = middy((event, context) => {
  return {}
})

handler.use(
  secretsManager({
    fetchData: {
      apiToken: 'dev/api_token'
    },
    awsClientOptions: {
      region: 'us-east-1'
    },
    setToContext: true
  })
)

// Before running the function handler, the middleware will fetch from Secrets Manager
handler(event, context, (_, response) => {
  // assuming the dev/api_token has two keys, 'Username' and 'Password'
  t.is(context.apiToken.Username, 'username')
  t.is(context.apiToken.Password, 'password')
})
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-secrets-manager` to the exclude list.

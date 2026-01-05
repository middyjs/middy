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

const lambdaHandler = (event, context) => {
  return {}
}

export const handler = middy()
  .use(
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
  .handler(lambdaHandler)

// Before running the function handler, the middleware will fetch from Secrets Manager
handler(event, context, (_, response) => {
  // assuming the dev/api_token has two keys, 'Username' and 'Password'
  strictEqual(context.apiToken.Username, 'username')
  strictEqual(context.apiToken.Password, 'password')
})
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-secrets-manager` to the exclude list.

## Usage with TypeScript

Data stored in SecretsManager can be stored as arbitrary structured data. It's not possible to know in advance what shape the fetched data will have, so by default the fetched secrets will have type `unknown`.

You can provide some type hints by leveraging the `secret` utility function. This function allows you to specify what's the expected type that will be fetched for every SecretsManager request.

The idea is that, for every request specified in the `fetchData` option, rather than just providing the parameter configuration as an object, you can wrap it in a `secret<ParamType>(key)` call. Internally, `secret` is a function that will return `key` as received, but it allows you to use generics to provide type hints for the expected fetched value type for that request.

This way TypeScript can understand how to treat the additional data attached to the context and stored in the internal storage.

The following example illustrates how to use `secret`:

```typescript
import middy from '@middy/core'
import secretsManager, { secret } from '@middy/secrets-manager'

const lambdaHandler = (event, context) => {
  console.log(context.config)
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }

  return response
}

export const handler = middy()
.use(
  secretsManager({
    fetchData: {
      someSecret: secret<{User: string, Password: string}>('someHiddenSecret')
    }),
    setToContext: true
  })
)
.before(async (request) => {
  const data = await getInternal('someSecret', request)
  // data.someSecret.User (string)
  // data.someSecret.Password (string)
  // or, since we have `setToContext: true`
  // request.context.someSecret.User (string)
  // request.context.someSecret.Password (string)
})
.handler(lambdaHandler)
```

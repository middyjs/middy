---
title: ssm
---

This middleware fetches parameters from [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html).

Parameters to fetch can be defined by path and by name (not mutually exclusive). See AWS docs [here](https://aws.amazon.com/blogs/mt/organize-parameters-by-hierarchy-tags-or-amazon-cloudwatch-events-with-amazon-ec2-systems-manager-parameter-store/).

Parameters can be assigned to the function handler's `context` object by setting the `setToContext` flag to `true`. By default all parameters are added with uppercase names.

The Middleware makes a single API request to fetch all the parameters defined by name, but must make an additional request per specified path. This is because the AWS SDK currently doesn't expose a method to retrieve parameters from multiple paths.

For each parameter defined by name, you also provide the name under which its value should be added to `context`. For each path, you instead provide a prefix, and by default the value import each parameter returned from that path will be added to `context` with a name equal to what's left of the parameter's full name _after_ the defined path, with the prefix prepended. If the prefix is an empty string, nothing is prepended. You can override this behaviour by providing your own mapping function with the `getParamNameFromPath` config option.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/ssm
```

## Options

- `AwsClient` (object) (default `SSMClient`): SSMClient class constructor (i.e. that has been instrumented with AWS X-Ray). Must be from `@aws-sdk/client-ssm`.
- `awsClientOptions` (object) (optional): Options to pass to SSMClient class constructor.
- `awsClientAssumeRole` (string) (optional): Internal key where role tokens are stored. See [@middy/sts](/docs/middlewares/sts) on to set this.
- `awsClientCapture` (function) (optional): Enable AWS X-Ray by passing `captureAWSClient` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to API request parameter `Names`/`Path`. `SecureString` are automatically decrypted.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `ssm`): Cache key for the fetched data responses. Must be unique across all middleware.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToContext` (boolean) (default `false`): Store role tokens to `request.context`.

NOTES:

- Lambda is required to have IAM permission for `ssm:GetParameters` and/or `ssm:GetParametersByPath` depending on what you're requesting.
- `SSM` has [throughput limitations](https://docs.aws.amazon.com/general/latest/gr/ssm.html). Switching to Advanced Parameter type or increasing `maxRetries` and `retryDelayOptions.base` in `awsClientOptions` may be required.

## Sample usage

```javascript
import middy from '@middy/core'
import ssm from '@middy/ssm'

const handler = middy((event, context) => {
  return {}
})

let globalDefaults = {}
handler
  .use(
    ssm({
      fetchData: {
        accessToken: '/dev/service_name/access_token', // single value
        dbParams: '/dev/service_name/database/', // object of values, key for each path
        defaults: '/dev/defaults'
      },
      setToContext: true
    })
  )
  .before((request) => {
    globalDefaults = request.context.defaults.global
  })
```

```javascript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import ssm from '@middy/ssm'

const handler = middy((event, context) => {
  return {}
})

let globalDefaults = {}
handler
  .use(
    ssm({
      fetchData: {
        defaults: '/dev/defaults'
      },
      cacheKey: 'ssm-defaults'
    })
  )
  .use(
    ssm({
      fetchData: {
        accessToken: '/dev/service_name/access_token', // single value
        dbParams: '/dev/service_name/database/' // object of values, key for each path
      },
      cacheExpiry: 15 * 60 * 1000,
      cacheKey: 'ssm-secrets'
    })
  )
  // ... other middleware that fetch
  .before(async (request) => {
    const data = await getInternal(
      ['accessToken', 'dbParams', 'defaults'],
      request
    )
    Object.assign(request.context, data)
  })
```

## Bundling

To exclude `aws-sdk` add `aws-sdk/clients/ssm.js` to the exclude list.

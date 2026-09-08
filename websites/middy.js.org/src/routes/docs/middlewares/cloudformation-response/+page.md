---
title: cloudformation-response
description: "Manage CloudFormation Custom Resource responses automatically with Middy."
---

Manage CloudFormation Custom Resource responses.

CloudFormation reads the outcome of a custom resource from a `PUT` to the presigned `event.ResponseURL`, not from the Lambda return value. The middleware fills in the required fields (`Status`, `RequestId`, `LogicalResourceId`, `StackId`, `PhysicalResourceId`) from the event and context, sends the body to `event.ResponseURL`, and returns the same object from the handler. A thrown error becomes a `FAILED` response whose `Reason` is the error message.

See [Custom resource request and response reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/crpg-ref-responses.html).

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/cloudformation-response
```

## Options

- `sendResponse` (boolean) (default `true`): `PUT` the shaped response to `event.ResponseURL`. Set to `false` when something else delivers it (for example a custom resource framework) and only the returned object is wanted.

NOTES:

- The body sent to CloudFormation is capped at 4096 bytes. When it is larger, `Reason` is cut down to fit and suffixed with ` [truncated]`; the returned object carries the same trimmed `Reason`. When the body still does not fit (for example a large `Data`), the invocation reports `FAILED` with a reason naming the cap, so the stack fails fast instead of waiting for the custom resource timeout.
- The handler must return an object (or nothing). A string, number or array cannot carry the response fields and is reported as `FAILED` with the reason `@middy/cloudformation-response: handler response must be an object`.
- The `PUT` uses an empty `Content-Type`, as the presigned URL is signed with. A non-2xx reply or a network failure is thrown so it shows up in the function logs.
- Nothing is sent when `event.ResponseURL` is absent, for example when invoking the function directly in a test.

## Sample usage

### General

```javascript
import middy from '@middy/core'
import cloudformationResponse from '@middy/cloudformation-response'

export const handler = middy((event, context) => {
  return {
    PhysicalResourceId: '...',
    Data: { Arn: '...' }
  }
}).use(cloudformationResponse())
```

### With a router

Pair with [`@middy/cloudformation-router`](/docs/routers/cloudformation-router) to dispatch on `RequestType`; the response middleware wraps the router.

```javascript
import middy from '@middy/core'
import cloudformationResponse from '@middy/cloudformation-response'
import cloudformationRouter from '@middy/cloudformation-router'

export const handler = middy()
  .use(cloudformationResponse())
  .handler(
    cloudformationRouter([
      {
        requestType: 'Create',
        handler: async (event, context) => ({ PhysicalResourceId: '...' })
      }
    ])
  )
```

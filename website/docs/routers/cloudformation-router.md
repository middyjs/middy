---
title: cloudformation-router
---

This handler can route to requests to one of a nested handler based on `requestType` of a CloudFormation Custom Response event.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/cloudformation-router
```

## Options

- `routes` (array[\{routeKey, handler\}]) (required): Array of route objects.
  - `routeKey` (string) (required): AWS formatted request type. ie `Create`, `Update`, `Delete`
  - `handler` (function) (required): Any `handler(event, context, {signal})` function
- `notFoundHandler` (function): Override default FAILED response with your own custom response. Passes in `{requestType}`

NOTES:

- Reponse parameters are automatically applied for `Status`, `RequestId`, `LogicalResourceId`, and/or `StackId` when not present.
- Errors should be handled as part of the router middleware stack **or** the lambdaHandler middleware stack. Handled errors in the later will trigger the `after` middleware stack of the former.
- Shared middlewares, connected to the router middleware stack, can only be run before the lambdaHandler middleware stack.

## Sample usage

```javascript
import middy from '@middy/core'
import cloudformationRouterHandler from '@middy/cloudformation-router'
import cloudformationResponseMiddleware from '@middy/cloudformation-response'
import validatorMiddleware from '@middy/validator'

const createHandler = middy()
  .use(validatorMiddleware({eventSchema: {...} }))
  .handler((event, context) => {
    return {
      PhysicalResourceId: '...',
      Data:{}
    }
  })

const updateHandler = middy()
  .use(validatorMiddleware({eventSchema: {...} }))
  .handler((event, context) => {
    return {
      PhysicalResourceId: '...',
      Data: {}
    }
  })

const deleteHandler = middy()
  .use(validatorMiddleware({eventSchema: {...} }))
  .handler((event, context) => {
    return {
      PhysicalResourceId: '...'
    }
  })

const routes = [
  {
    requesType: 'Create',
    handler: createHandler
  },
  {
    requesType: 'Update',
    handler: updateHandler
  },
  {
    routeKey: 'Delete',
    handler: deleteHandler
  }
]

export const handler = middy()
  .use(cloudformationResponseMiddleware())
  .handler(cloudformationRouterHandler(routes))
```

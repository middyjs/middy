---
title: Use with TypeScript
position: 6
---

Middy can be used with TypeScript with typings built in in every official package.

Here's an example of how you might be using Middy with TypeScript for a Lambda receiving events from API Gateway:

```typescript
import middy from '@middy/core'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

async function lambdaHandler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // the returned response will be checked against the type `APIGatewayProxyResult`
  return {
    statusCode: 200,
    body: `Hello from ${event.path}`
  }
}

let handler = middy(lambdaHandler)
  .use(someMiddleware)
  .use(someOtherMiddleware)

export default handler
```

You can also [write custom middlewares with TypeScript](/docs/writing-middlewares/intro).

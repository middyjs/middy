---
title: With TypeScript
position: 7
---

here's an example of how you can write a custom middleware for a Lambda receiving events from API Gateway:

```typescript
import middy from '@middy/core'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

const middleware = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request
  ): Promise<void> => {
    // Your middleware logic
  }

  const after: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request
  ): Promise<void> => {
    // Your middleware logic
  }

  return {
    before,
    after
  }
}

export default middleware
```

**Note**: The Middy core team does not use TypeScript often and we can't certainly claim that we are TypeScript experts. We tried our best to come up
with type definitions that should give TypeScript users a good experience. There is certainly room for improvement, so we would be more than happy to receive contributions 😊

See `devDependencies` for each middleware for list of dependencies that may be required with transpiling TypeScript.

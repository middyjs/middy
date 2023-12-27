---
title: Use with TypeScript
position: 6
---

Middy can be used with TypeScript with typings built in in every official package.

You may need to install additional types for AWS Lambda.

```bash
npm i -D @types/aws-lambda
```

Here's an example of how you might be using Middy with TypeScript for a Lambda receiving events from API Gateway and fetching secrets from Secrets Manager:

```typescript
import middy from '@middy/core'
import secretsManager from '@middy/secrets-manager'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

export const handler = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
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
  .handler(async (req, context) => {
    // The context type gets augmented here by the secretsManager middleware.
    // This is just an example, obviously don't ever log your secret in real life!
    console.log(context.apiToken)
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Hello from ${event.path}`,
        req
      })
    }
  })
```

Note that when using TypeScript, you should use what we call the _Middleware-first, Handler-last_ approach, which means that you should always call the `handler` method last, after you have attached all the middlewares you need.

This approach makes sure that, as you attach middlewares, the type system understands how the `event` and the `context` arguments are augmented by the various middlewares and inside your handler code you can have a nice type-checking and auto-completion experience.

You can also [write custom middlewares with TypeScript](/docs/writing-middlewares/intro).

This is an example tsconfig.json file that can be used for typescript projects

```
{
  "compilerOptions": {
    "incremental": true,
    "target": "es2020",
    "module": "es2020",
    "declaration": true,
    "sourceMap": true,
    "composite": true,
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "preserveConstEnums": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "rootDir": ".",
    "outDir": "lib"
  }
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules"]
}

```

---
title: Streamify Response
position: 5
---

Middy also supports streamed responses.

> You can progressively stream response payloads through Lambda function URLs, including as an Amazon CloudFront origin, along with using the AWS SDK or using Lambda’s invoke API. You can not use Amazon API Gateway and Application Load Balancer to progressively stream response payloads, but you can use the functionality to return larger payloads. (https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/)

1. Set `executionMode: executionModeStreamifyResponse` into middy options
2. a. For HTTP Events return using an HTTP event response with the body as a string or ReadableStream.
   b. For InvokeWithResponseStream Events return a response with a string or ReadableStream.

- API Gateway: If you're getting a `500` status code. Be sure to set your integration to `HTTP_PROXY` over `LAMBDA_PROXY` and enable Function URL on the lambda.
- Function URLs: If receiving no content and non-200 status code are being converted to `200`. Be sure to set `Invoke Mode` to `RESPONSE_STREAM` over `BUFFERED`.

## Lambda Function URL Example

```javascript
import middy from '@middy/core'
import { executionModeStreamifyResponse } from '@middy/core/StreamifyResponse'
import { createReadableStream } from '@datastream/core'

const lambdaHandler = (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv'
    },
    body: createReadableStream('...') // or string
  }
}

export const handler = middy({ executionMode: executionModeStreamifyResponse }).handler(lambdaHandler)
```

## Lambda InvokeWithResponseStream Example

```javascript
import middy from '@middy/core'
import { executionModeStreamifyResponse } from '@middy/core/StreamifyResponse'
import { createReadableStream } from '@datastream/core'

const lambdaHandler = (event, context) => {
  return createReadableStream('...') // or string
}
export const handler = middy({ executionMode: executionModeStreamifyResponse }).handler(lambdaHandler)
```

### Requesting Lambda

```javascript
import {
  LambdaClient,
  InvokeWithResponseStreamCommand
} from '@aws-sdk/client-lambda'

const lambda = new LambdaClient()

const res = await lambda.send(
  new InvokeWithResponseStreamCommand({
    FunctionName: 'function-name',
    Payload: JSON.stringify({...})
  })
)

const decoder = new TextDecoder('utf-8')
let body = ''
for await (const chunk of res.EventStream) {
  if (chunk?.PayloadChunk?.Payload) {
    body += decoder.decode(Buffer.from(chunk.PayloadChunk.Payload))
  }
}
```

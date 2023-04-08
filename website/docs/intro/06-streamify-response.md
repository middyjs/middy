---
title: Streamify Response
position: 5
---

Middy also supports streamed responses.

1. Set `streamifyResponse: true` into middy options
2. Return using an HTTP event response with the body as a string or ReadableStream.
3. If using Function URLs, be sure to set `Invoke Mode` to `RESPONSE_STREAM`.

```javascript
import middy from '@middy/core'
import { createReadableStream } from '@datastream/core'

export const handler = middy({ streamifyResponse: true }).handler(
  (event, context) => {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv'
      },
      body: createReadableStream('...') // or string
    }
  }
)
```

https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/

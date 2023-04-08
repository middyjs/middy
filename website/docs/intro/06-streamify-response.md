---
title: Streamify Response
position: 5
---

Middy also supports streamed responses.

1. Set `streamifyResponse: true` into middy options
2. Return using an HTTP event response with a ReadableStream for the body.

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
      body: createReadableStream('...')
    }
  }
)
```

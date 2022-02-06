---
title: http-cors
---

This middleware sets HTTP CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Credentials`), necessary for making cross-origin requests, to the response object.

Sets headers in `after` and `onError` phases.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-cors
```


## Options

 - `credentials` (bool) (optional): if true, sets `Access-Control-Allow-Credentials` (default `false`)
 - `headers` (string) (optional): value to put in `Access-Control-Allow-Headers` (default: `false`)
 - `methods` (string) (optional): value to put in `Access-Control-Allow-Methods` (default: `false`)
 - `getOrigin` (function(incomingOrigin:string, options)) (optional): take full control of the generating the returned origin. Defaults to using the origin or origins option.
 - `origin` (string) (optional): origin to put in the header (default: "`*`")
 - `origins` (array) (optional): An array of allowed origins. The incoming origin is matched against the list and is returned if present. 
 - `exposeHeaders` (string) (optional): value to put in `Access-Control-Expose-Headers` (default: `false`)
 - `maxAge` (string) (optional): value to put in Access-Control-Max-Age header (default: `null`)
 - `requestHeaders` (string) (optional): value to put in `Access-Control-Request-Headers` (default: `false`)
 - `requestMethods` (string) (optional): value to put in `Access-Control-Request-Methods` (default: `false`)
 - `cacheControl` (string) (optional): value to put in Cache-Control header on pre-flight (OPTIONS) requests (default: `null`)

```javascript
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'
import cors from '@middy/http-cors'

const handler = middy((event, context) => {
  throw new createError.UnprocessableEntity()
})
handler.use(httpErrorHandler())
       .use(cors())
           
// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  t.is(response.headers['Access-Control-Allow-Origin'],'*')
  t.deepEqual(response,{
      statusCode: 422,
      body: 'Unprocessable Entity'
    })
})
```

## Sample usage

```javascript
import middy from '@middy/core'
import cors from '@middy/http-cors'

const handler = middy((event, context) => {
  return {}
})

handler.use(cors())

// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  t.is(response.headers['Access-Control-Allow-Origin'],'*')
})
```

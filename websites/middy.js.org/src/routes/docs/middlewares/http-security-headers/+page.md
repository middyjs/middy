---
title: http-security-headers
description: "Apply security headers like HSTS, CSP, and X-Frame-Options to Lambda HTTP responses."
---

Applies best practice security headers to responses. It's a simplified port of HelmetJS. See [HelmetJS](https://helmetjs.github.io/) documentation for more details.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-security-headers
```

## Features
- `dnsPrefetchControl` controls browser DNS prefetching
- `frameOptions` to prevent clickjacking
- `poweredBy` to remove the Server/X-Powered-By header
- `strictTransportSecurity` for HTTP Strict Transport Security
- `downloadOptions` sets X-Download-Options for IE8+
- `contentTypeOptions` to keep clients from sniffing the MIME type
- `referrerPolicy` to hide the Referer header
- `xssProtection` sets `X-XSS-Protection: 0` to disable the legacy browser XSS filter

## Options

There are a lot, see [source](https://github.com/middyjs/middy/blob/main/packages/http-security-headers/index.js#L5)

## Sample usage

```javascript
import middy from '@middy/core'
import httpSecurityHeaders from '@middy/http-security-headers'

const lambdaHandler = (event, context) => {
  return {}
}

export const handler = middy().use(httpSecurityHeaders()).handler(lambdaHandler)
```

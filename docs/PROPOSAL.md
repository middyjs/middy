# v2 Implementation Proposal

https://github.com/middyjs/middy/issues/585

```js

const handler = async (event, context) => {
  // ...
  return {
    statusCode: 200,
    body: {}
  }
}
const middlewareArray = []

// Wraps each middleware / runtime
// Allows for performance timing and custom overrides
const middlewareWrapper = {
  before: async(handler, id) => handler,
  after: async(handler, id) => handler,
  error: async(handler, id) => handler
}

import { getContext, setContext, getCache, setCache } from '@middy/core/util'
const middleware = async (options = {}) => {
  
  return {
    before: async(handler) => {
      if (badReq) throw new Error()
      const cachedOptions = getCache('options')
      if (options.cacheDuration && cachedOptions) {
        options = cachedOptions
      } else {
        options = getContext(options, handler.context)
      }
    },
    after: async(handler) => {
      
    }, // Defaults to passthrough
    //error: async(handler) => handler
  }
}

module.exports = middy(handler, middlewareArray, middlewareWrapper)

handler.use(middleware({
  ...options,
  fetchData: {
    optionKey: contextKey, // db-manager or use getContext
    contextKey: fetchKey // fetch key middlewares
  },
  cacheExpiry: 0,
  awsClient: undefined,
  awsClientOptions: {},
  clearSecrets:false,
  assumeRole: '',
  setContext: {},
  getContext: {
    // optionKey: contextKey
    assumeRole: 'sts_role_to_assume'
  }
}))

module.exports = handler
```

# TODO
- [ ] Get svg of current logo
- [ ] Update testing - https://github.com/aws/aws-sdk-js-v3/issues/1156
- [ ] allow ssm to pull > 10 keys (if possible)
- [ ] update avj to support draft-2019-09
- [ ] Native router?
- [ ] Documentation
  - [ ] Example using AWS X-Ray
  - [ ] Example using fips 140-2
  - [ ] Examples showing middleware ordering (apigw, s3, sqs, sns, edge)
  - [ ] Performance best practice
  - [ ] Security best practice
  
## Middleware (Grouped by type)

### Misc
- [x] `function-shield` [deprecated, remove]
- [x] `warmup` [deprecated, remove]
- [x] `cache` [deprecate, due to low usage]
- [x] `input-output-logger`
- [x] `do-not-wait-for-empty-event-loop` [deprecate?, show inline handler examples]

### Request Transformation
- [x] `s3-key-normalizer`
- [x] `sqs-json-body-parser`
- [x] `http-event-normalizer`
- [x] `http-header-normalizer`
- [x] `http-json-body-parser`
- [x] `http-multipart-body-parser`
- [x] `http-urlencode-path-parser`
- [x] `http-urlencode-body-parser`
- [x] `http-content-negotiation`

  
### Response Transformation
- [x] `http-server-timing` [new]
- [x] `http-cors`
- [x] `http-security-headers`
- [x] `http-partial-response`
- [x] `http-response-serializer`

### Request/Response Transformation
- [-] `validator`
  - include i18n
  - update doc to show how to use extra formats / keywords
  
### Fetch Keys
- [-] `sts` (AWS) [new]
- [-] `ssm` (AWS)
- [-] `secrets-manager` (AWS)
- [-] `rds-signer` (AWS) [new]
- [ ] `sqs-partial-batch-failure` (AWS)

### Database
- [ ] `db-manager` [deprecate, due to low usage]

### Error Handling
- [x] `http-error-handler`
- [x] `error-logger`

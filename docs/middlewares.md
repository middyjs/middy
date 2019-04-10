# Middlewares documentation

## Available middlewares

- [cache](#cache)
- [cors](#cors)
- [doNotWaitForEmptyEventLoop](#donotwaitforemptyeventloop)
- [functionShield](#functionshield)
- [httpContentNegotiation](#httpcontentnegotiation)
- [httpErrorHandler](#httperrorhandler)
- [httpEventNormalizer](#httpeventnormalizer)
- [httpHeaderNormalizer](#httpheadernormalizer)
- [httpMultipartBodyParser](#httpmultipartbodyparser)
- [httpPartialResponse](#httppartialresponse)
- [httpSecurityHeaders](#httpsecurityheaders)
- [jsonBodyParser](#jsonbodyparser)
- [s3KeyNormalizer](#s3keynormalizer)
- [secretsManager](#secretsmanager)
- [ssm](#ssm)
- [validator](#validator)
- [urlEncodeBodyParser](#urlencodebodyparser)
- [warmup](#warmup)

## [cache](/src/middlewares/cache.js)

Offers a simple but flexible caching layer that allows to cache the response associated
to a given event and return it directly (without running the handler) if the same event is received again
in a successive execution.

By default, the middleware stores the cache in memory, so the persistence is guaranteed only for
a short amount of time (the duration of the container), but you can use the configuration
layer to provide your own caching implementation.

### Options

- `calculateCacheId` (function) (optional): a function that accepts the `event` object as a parameter
  and returns a promise that resolves to a string which is the cache id for the
  give request. By default the cache id is calculated as `md5(JSON.stringify(event))`.
- `getValue` (function) (optional): a function that defines how to retrieve the value associated to a given
  cache id from the cache storage. It accepts `key` (a string) and returns a promise
  that resolves to the cached response (if any) or to `undefined` (if the given key
  does not exists in the cache)
- `setValue` (function) (optional): a function that defines how to set a value in the cache. It accepts
  a `key` (string) and a `value` (response object). It must return a promise that
  resolves when the value has been stored.

### Sample usage

```javascript
// assumes the event contains a unique event identifier
const calculateCacheId = event => Promise.resolve(event.id)
// use in-memory storage as example
const myStorage = {}
// simulates a delay in retrieving the value from the caching storage
const getValue = key =>
  new Promise((resolve, reject) => {
    setTimeout(() => resolve(myStorage[key]), 100)
  })
// simulates a delay in writing the value in the caching storage
const setValue = (key, value) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      myStorage[key] = value
      return resolve()
    }, 100)
  })

const originalHandler = (event, context, cb) => {
  /* ... */
}

const handler = middy(originalHandler).use(
  cache({
    calculateCacheId,
    getValue,
    setValue
  })
)
```

## [cors](/src/middlewares/cors.js)

Sets CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Credentials`), necessary for making cross-origin requests, to the response object.

Sets headers in `after` and `onError` phases.

### Options

- `origin` (string) (optional): origin to put in the header (default: "`*`").
- `origins` (array) (optional): An array of allowed origins. The incoming origin is matched against the list and is returned if present.
- `headers` (string) (optional): value to put in Access-Control-Allow-Headers (default: `null`)
- `credentials` (bool) (optional): if true, sets the `Access-Control-Allow-Origin` as request header `Origin`, if present (default `false`)

NOTES:
- If another middleware does not handle and swallow errors, then it will bubble all the way up
and terminate the Lambda invocation with an error. In this case API Gateway would return a default 502 response, and the CORS headers would be lost. To prevent this, you should use the `httpErrorHandler` middleware before the `cors` middleware like this:

```javascript
const middy = require('middy')
const { httpErrorHandler, cors } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  throw new createError.UnprocessableEntity()
})

handler.use(httpErrorHandler())
       .use(cors())

// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  expect(response.headers['Access-Control-Allow-Origin']).toEqual('*')
  expect(response).toEqual({
      statusCode: 422,
      body: 'Unprocessable Entity'
    })
})
```

### Sample usage

```javascript
const middy = require('middy')
const { cors } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(cors())

// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  expect(response.headers['Access-Control-Allow-Origin']).toEqual('*')
})
```

## [doNotWaitForEmptyEventLoop](/src/middlewares/doNotWaitForEmptyEventLoop.js)

Sets `context.callbackWaitsForEmptyEventLoop` property to `false`.
This will prevent Lambda from timing out because of open database connections, etc.

### Options

By default the middleware sets the `callbackWaitsForEmptyEventLoop` property to `false` only in the `before` phase,
meaning you can override it in handler to `true` if needed. You can set it in all steps with the options:

- `runOnBefore` (defaults to `true`) - sets property before running your handler
- `runOnAfter` (defaults to `false`)
- `runOnError` (defaults to `false`)

### Sample Usage

```javascript
const middy = require('middy')
const { doNotWaitForEmptyEventLoop } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(doNotWaitForEmptyEventLoop({ runOnError: true }))

// When Lambda runs the handler it gets context with callbackWaitsForEmptyEventLoop property set to false

handler(event, context, (_, response) => {
  expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
})
```

## functionShield

Hardens AWS Lambda execution environment.

**Note**: functionShield has been removed from core since _0.22.0_. Use [`@middy/function-shield`](https://www.npmjs.com/package/@middy/function-shield) instead.

## [httpContentNegotiation](/src/middlewares/httpContentNegotiation.js)

Parses `Accept-*` headers and provides utilities for [HTTP content negotiation](https://tools.ietf.org/html/rfc7231#section-5.3) (charset, encoding, language and media type).

By default the middleware parses charsets (`Accept-Charset`), languages (`Accept-Language`), encodings (`Accept-Encoding`) and media types (`Accept`) during the
`before` phase and expands the `event` object by adding the following properties:

- `preferredCharsets` (`array`) - The list of charsets that can be safely used by the app (as the result of the negotiation)
- `preferredCharset` (`string`) - The preferred charset (as the result of the negotiation)
- `preferredEncodings` (`array`) - The list of encodings that can be safely used by the app (as the result of the negotiation)
- `preferredEncoding` (`string`) - The preferred encoding (as the result of the negotiation)
- `preferredLanguages` (`array`) - The list of languages that can be safely used by the app (as the result of the negotiation)
- `preferredLanguage` (`string`) - The preferred language (as the result of the negotiation)
- `preferredMediaTypes` (`array`) - The list of media types that can be safely used by the app (as the result of the negotiation)
- `preferredMediaType` (`string`) - The preferred media types (as the result of the negotiation)

This middleware expects the headers in canonical format, so it should be attached after the [`httpHeaderNormalizer`](#httpheadernormalizer) middleware.
It also can throw an HTTP exception, so it can be convenient to use it in combination with the [`httpErrorHandler`](#httperrorhandler).

### Options

- `parseCharsets` (defaults to `true`) - Allows enabling/disabling the charsets parsing
- `availableCharsets` (defaults to `undefined`) - Allows defining the list of charsets supported by the Lambda function
- `parseEncodings` (defaults to `true`) - Allows enabling/disabling the encodings parsing
- `availableEncodings` (defaults to `undefined`) - Allows defining the list of encodings supported by the Lambda function
- `parseLanguages` (defaults to `true`) - Allows enabling/disabling the languages parsing
- `availableLanguages` (defaults to `undefined`) - Allows defining the list of languages supported by the Lambda function
- `parseMediaTypes` (defaults to `true`) - Allows enabling/disabling the media types parsing
- `availableMediaTypes` (defaults to `undefined`) - Allows defining the list of media types supported by the Lambda function
- `failOnMismatch` (defaults to `true`) - If set to true it will throw an HTTP `NotAcceptable` (406) exception when the negotiation fails for one of the headers (e.g. none of the languages requested are supported by the app)

### Sample Usage

```javascript
const middy = require('middy')
const {
  httpContentNegotiation,
  httpHeaderNormalizer,
  httpErrorHandler
} = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  let message, body

  switch (event.preferredLanguage) {
    case 'it-it':
      message = 'Ciao Mondo'
      break
    case 'fr-fr':
      message = 'Bonjour le monde'
      break
    default:
      message = 'Hello world'
  }

  switch (event.preferredMediaType) {
    case 'application/xml':
      body = `<message>${message}</message>`
      break
    case 'application/yaml':
      body = `---\nmessage: ${message}`
      break
    case 'application/json':
      body = JSON.stringify({ message })
      break
    default:
      body = message
  }

  return cb(null, {
    statusCode: 200,
    body
  })
})

handler
  .use(httpHeaderNormalizer())
  .use(
    httpContentNegotiation({
      parseCharsets: false,
      parseEncodings: false,
      availableLanguages: ['it-it', 'fr-fr', 'en'],
      availableMediaTypes: [
        'application/xml',
        'application/yaml',
        'application/json',
        'text/plain'
      ]
    })
  )
  .use(httpErrorHandler())

module.exports = { handler }
```

## [httpErrorHandler](/src/middlewares/httpErrorHandler.js)

Automatically handles uncaught errors that are created with
[`http-errors`](https://npm.im/http-errors) and creates a proper HTTP response
for them (using the message and the status code provided by the error object).

It should be set as the last error handler.

### Options

- `logger` (defaults to `console.error`) - a logging function that is invoked with the current error as an argument. You can pass `false` if you don't want the logging to happen.

### Sample usage

```javascript
const middy = require('middy')
const { httpErrorHandler } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  throw new createError.UnprocessableEntity()
})

handler.use(httpErrorHandler())

// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  expect(response).toEqual({
    statusCode: 422,
    body: 'Unprocessable Entity'
  })
})
```

## [httpEventNormalizer](/src/middlewares/httpEventNormalizer.js)

If you need to access the query string or path parameters in an API Gateway event you
can do so by reading the attributes in `event.queryStringParameters` and
`event.pathParameters`, for example: `event.pathParameters.userId`. Unfortunately
if there are no parameters for these parameter holders, the relevant key `queryStringParameters`
or `pathParameters` won't be available in the object, causing an expression like `event.pathParameters.userId`
to fail with the error: `TypeError: Cannot read property 'userId' of undefined`.

A simple solution would be to add an `if` statement to verify if the `pathParameters` (or `queryStringParameters`)
exists before accessing one of its parameters, but this approach is very verbose and error prone.

This middleware normalizes the API Gateway event, making sure that an object for
`queryStringParameters` and `pathParameters` is always available (resulting in empty objects
when no parameter is available), this way you don't have to worry about adding extra `if`
statements before trying to read a property and calling `event.pathParameters.userId` will
result in `undefined` when no path parameter is available, but not in an error.

### Sample usage

```javascript
const middy = require('middy')
const { httpEventNormalizer } = require('middy/httpEventNormalizer')

const handler = middy((event, context, cb) => {
  console.log('Hello user #{event.pathParameters.userId}') // might produce `Hello user #undefined`, but not an error
  cb(null, {})
})

handler.use(httpEventNormalizer())
```

## [httpHeaderNormalizer](/src/middlewares/httpHeaderNormalizer.js)

Normalizes HTTP header names to their canonical format. Very useful if clients are
not using the canonical names of header (e.g. `content-type` as opposed to `Content-Type`).

API Gateway does not perform any normalization, so the headers are propagated to Lambda
exactly as they were sent by the client.

Other middlewares like [`jsonBodyParser`](#jsonbodyparser) or [`urlEncodeBodyParser`](#urlencodebodyparser)
will rely on headers to be in the canonical format, so if you want to support non-normalized headers in your
app you have to use this middleware before those ones.

This middleware will copy the original headers in `event.rawHeaders`.

### Options

- `normalizeHeaderKey` (function) (optional): a function that accepts an header name as a parameter and returns its
  canonical representation.

### Sample usage

```javascript
const middy = require('middy')
const {
  httpHeaderNormalizer,
  jsonBodyParser,
  urlEncodeBodyParser
} = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler
  .use(httpHeaderNormalizer())
  .use(jsonBodyParser())
  .use(urlEncodeBodyParser())
```

## [httpMultipartBodyParser](/src/middlewares/httpMultipartBodyParser.js)

Automatically parses HTTP requests with content type `multipart/form-data` and converts the body into an
object. Also handles gracefully broken JSON as UnprocessableEntity (422 errors)
if used in combination with `httpErrorHandler`.

It can also be used in combination with validator so that the content can be validated.

**Note**: by default this is going to parse only events that contain the header `Content-Type` (or `content-type`) set to `multipart/form-data`. If you want to support different casing for the header name (e.g. `Content-type`) then you should use the [`httpHeaderNormalizer`](#httpheadernormalizer) middleware before this middleware.

```javascript
const middy = require('middy')
const { httpMultipartBodyParser } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(httpMultipartBodyParser())

// invokes the handler
const event = {
  headers: {
    'content-type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
  },
  body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t',
  isBase64Encoded: true
}
handler(event, {}, (_, body) => {
  expect(body).toEqual({ foo: 'bar' })
})
```

### Options:

- `busboy` (object) (optional): defaults to `{}` and it can be used to pass extraparameters to the internal `busboy` instance at creation time. Checkout [the official documentation](https://www.npmjs.com/package/busboy#busboy-methods) for more information on the supported options.

**Note**: this middleware will buffer all the data as it is processed internally by `busboy`, so, if you are using this approach to parse significantly big volumes of data, keep in mind that all the data will be allocated in memory. This is somewhat inevitable with Lambdas (as the data is already encoded into the JSON in memory as Base64), but it's good to keep this in mind and evaluate the impact on you application.  
If you really have to deal with big files, then you might also want to consider to allowing your users to [directly upload files to S3](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-UsingHTTPPOST.html)

## [httpPartialResponse](/src/middlewares/httpPartialResponse.js)

Filtering the data returned in an object or JSON stringified response has never been so easy. Add the `httpPartialResponse` middleware to your middleware chain, specify a custom `filteringKeyName` if you want to and that's it. Any consumer of your API will be able to filter your JSON response by adding a querystring key with the fields to filter such as `fields=firstname,lastname`.

This middleware is based on the awesome `json-mask` package written by [Yuriy Nemtsov](https://github.com/nemtsov)

```javascript
const middy = require('middy')
const { httpPartialResponse } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  const response = {
    statusCode: 200,
    body: {
      firstname: 'John',
      lastname: 'Doe',
      gender: 'male',
      age: 30,
      address: {
        street: 'Avenue des Champs-Élysées',
        city: 'Paris'
      }
    }
  }

  cb(null, response)
})

handler.use(httpPartialResponse())

const event = {
  queryStringParameters: {
    fields: 'firstname,lastname'
  }
}

handler(event, {}, (_, response) => {
  expect(response.body).toEqual({
    firstname: 'John',
    lastname: 'Doe'
  })
})
```

## [httpSecurityHeaders](/src/middlewares/httpSecurityHeaders.js)

Applies best practice security headers to responses. It's a simplified port of [HelmetJS](https://helmetjs.github.io). See HelmetJS documentation of option details.

### Options

- `dnsPrefetchControl` controls browser DNS prefetching
- `expectCt` for handling Certificate Transparency [Future Feature]
- `frameguard` to prevent clickjacking
- `hidePoweredBy` to remove the Server/X-Powered-By header
- `hsts` for HTTP Strict Transport Security
- `ieNoOpen` sets X-Download-Options for IE8+
- `noSniff` to keep clients from sniffing the MIME type
- `referrerPolicy` to hide the Referer header
- `xssFilter` adds some small XSS protections

### Sample usage

```javascript
const middy = require('middy')
const { httpSecurityHeaders } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(httpSecurityHeaders())
```

## [jsonBodyParser](/src/middlewares/jsonBodyParser.js)

Automatically parses HTTP requests with a JSON body and converts the body into an
object. Also handles gracefully broken JSON as UnprocessableEntity (422 errors)
if used in combination with `httpErrorHandler`.

It can also be used in combination with validator as a prior step to normalize the
event body input as an object so that the content can be validated.

**Note**: by default this is going to parse only events that contain the header `Content-Type` (or `content-type`) set to `application/json`. If you want to support different casing for the header name (e.g. `Content-type`) then you should use the [`httpHeaderNormalizer`](#httpheadernormalizer) middleware before this middleware.

```javascript
const middy = require('middy')
const { jsonBodyParser } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(jsonBodyParser())

// invokes the handler
const event = {
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ foo: 'bar' })
}
handler(event, {}, (_, body) => {
  expect(body).toEqual({ foo: 'bar' })
})
```

## [s3KeyNormalizer](/src/middlewares/s3KeyNormalizer.js)

Normalizes key names in s3 events.

S3 events like S3 PUT and S3 DELETE will contain in the event a list of the files
that were affected by the change.

In this list the file keys are encoded [in a very peculiar way](http://docs.aws.amazon.com/AmazonS3/latest/dev/notification-content-structure.html) (urlencoded and
space characters replaced by a `+`). Very often you will use the
key directly to perform operations on the file using the AWS S3 SDK, in which case it's very easy to forget to decode the key correctly.

This middleware, once attached, makes sure that every S3 event has the file keys
properly normalized.

### Sample usage

```javascript
const middy = require('middy')
const { s3KeyNormalizer } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  // use the event key directly without decoding it
  console.log(event.Records[0].s3.object.key)

  // return all the keys
  callback(null, event.Records.map(record => record.s3.object.key))
})

handler.use(s3KeyNormalizer())
```

## [secretsManager](/src/middlewares/secretsManager.js)

Fetches parameters from [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).

Secrets to fetch can be defined by by name. See AWS docs [here](https://docs.aws.amazon.com/secretsmanager/latest/userguide/tutorials_basic.html).

Secrets are assigned to the function handler's `context` object.

The Middleware makes a single [API request](https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html) for each secret as Secrets Manager does not support batch get.

For each secret, you also provide the name under which its value should be added to `context`.

### Options

- `cache` (boolean) (optional): Defaults to `false`. Set it to `true` to skip further calls to AWS Secrets Manager
- `cacheExpiryInMillis` (int) (optional): Defaults to `undefined`. Use this option to invalidate cached secrets from Secrets Manager
- `secrets` (object) : Map of secrets to fetch from Secrets Manager, where the key is the destination, and value is secret name in Secrets Manager.
  Example: `{secrets: {RDS_LOGIN: 'dev/rds_login'}}`
- `awsSdkOptions` (object) (optional): Options to pass to AWS.SecretsManager class constructor.
- `throwOnFailedCall` (boolean) (optional): Defaults to `false`. Set it to `true` if you want your lambda to fail in case call to AWS Secrets Manager fails (secrets don't exist or internal error). It will only print error if secrets are already cached.

NOTES:

- Lambda is required to have IAM permission for `secretsmanager:GetSecretValue` action
- `aws-sdk` version of `2.176.0` or greater is required. If your project doesn't currently use `aws-sdk`, you may need to install it as a `devDependency` in order to run tests

### Sample Usage

Simplest usage, exports parameters as environment variables.

```javascript
const middy = require('middy')
const { secretsManager } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(
  secretsManager({
    cache: true,
    secrets: {
      RDS_LOGIN: 'dev/rds_login'
    }
  })
)

// Before running the function handler, the middleware will fetch from Secrets Manager
handler(event, context, (_, response) => {
  // assuming the dev/rds_login has two keys, 'Username' and 'Password'
  expect(context.RDS_LOGIN.Username).toEqual('username')
  expect(context.RDS_LOGIN.Password).toEqual('password')
})
```

## [ssm](/src/middlewares/ssm.js)

Fetches parameters from [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html).

Parameters to fetch can be defined by path and by name (not mutually exclusive). See AWS docs [here](https://aws.amazon.com/blogs/mt/organize-parameters-by-hierarchy-tags-or-amazon-cloudwatch-events-with-amazon-ec2-systems-manager-parameter-store/).

By default parameters are assigned to the Node.js `process.env` object. They can instead be assigned to the function handler's `context` object by setting the `setToContext` flag to `true`. By default all parameters are added with uppercase names.

The Middleware makes a single API request to fetch all the parameters defined by name, but must make an additional request per specified path. This is because the AWS SDK currently doesn't expose a method to retrieve parameters from multiple paths.

For each parameter defined by name, you also provide the name under which its value should be added to `process.env` or `context`. For each path, you instead provide a prefix, and by default the value from each parameter returned from that path will be added to `process.env` or `context` with a name equal to what's left of the parameter's full name _after_ the defined path, with the prefix prepended. If the prefix is an empty string, nothing is prepended. You can override this behaviour by providing your own mapping function with the `getParamNameFromPath` config option.

### Options

- `cache` (boolean) (optional): Defaults to `false`. Set it to `true` to skip further calls to AWS SSM
- `cacheExpiryInMillis` (int) (optional): Defaults to `undefined`. Use this option to invalidate cached parameter values from SSM
- `paths` (object) (optional\*): Map of SSM paths to fetch parameters from, where the key is the prefix for the destination name, and value is the SSM path. Example: `{paths: {DB_: '/dev/service/db'}}`
- `names` (object) (optional\*): Map of parameters to fetch from SSM, where the key is the destination, and value is param name in SSM.
  Example: `{names: {DB_URL: '/dev/service/db_url'}}`
- `awsSdkOptions` (object) (optional): Options to pass to AWS.SSM class constructor.
  Defaults to `{ maxRetries: 6, retryDelayOptions: {base: 200} }`
- `onChange` (function) (optional): Callback triggered when call was made to SSM. Useful when you need to regenerate something with different data. Example: `{ onChange: () => { console.log('New data available')} }`
- `setToContext` (boolean) (optional): This will assign parameters to the `context` object
  of the function handler rather than to `process.env`. Defaults to `false`

NOTES:

- While you don't need _both_ `paths` and `names`, you do need at least one of them!
- Lambda is required to have IAM permissions for `ssm:GetParameters*` actions
- `aws-sdk` version of `2.176.0` or greater is required. If your project doesn't currently use `aws-sdk`, you may need to install it as a `devDependency` in order to run tests

### Sample Usage

Simplest usage, exports parameters as environment variables.

```javascript
const middy = require('middy')
const { ssm } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(
  ssm({
    cache: true,
    paths: {
      SOME_PREFIX_: '/dev/db'
    },
    names: {
      SOME_ACCESS_TOKEN: '/dev/service_name/access_token'
    }
  })
)

// Before running the function handler, the middleware will fetch SSM params
handler(event, context, (_, response) => {
  expect(process.env.SOME_PREFIX_CONNECTION_STRING).toEqual(
    'some-connection-string'
  ) // The '/dev/db' path contains the CONNECTION_STRING parameter
  expect(process.env.SOME_ACCESS_TOKEN).toEqual('some-access-token')
})
```

Export parameters to `context` object, override AWS region.

```javascript
const middy = require('middy')
const { ssm } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(
  ssm({
    cache: true,
    names: {
      SOME_ACCESS_TOKEN: '/dev/service_name/access_token'
    },
    awsSdkOptions: { region: 'us-west-1' },
    setToContext: true
  })
)

handler(event, context, (_, response) => {
  expect(context.SOME_ACCESS_TOKEN).toEqual('some-access-token')
})
```

## [validator](/src/middlewares/validator.js)

Automatically validates incoming events and outgoing responses against custom
schemas defined with the [JSON schema syntax](http://json-schema.org/).

If an incoming event fails validation a `BadRequest` error is raised.
If an outgoing response fails validation a `InternalServerError` error is
raised.

This middleware can be used in combination with
[`httpErrorHandler`](#httperrorhandler) to automatically return the right
response to the user.

It can also be used in combination with [`httpcontentnegotiation`](#httpContentNegotiation) to load localised translations for the error messages (based on the currently requested language). This feature uses internally [`ajv-i18n`](http://npm.im/ajv-i18n) module, so reference to this module for options and more advanced use cases. By default the language used will be English (`en`), but you can redefine the default language by passing it in the `ajvOptions` options with the key `defaultLanguage` and specifying as value one of the [supported locales](https://www.npmjs.com/package/ajv-i18n#supported-locales).

### Options

- `inputSchema` (object) (optional): The JSON schema object that will be used
  to validate the input (`handler.event`) of the Lambda handler.
- `outputSchema` (object) (optional): The JSON schema object that will be used
  to validate the output (`handler.response`) of the Lambda handler.
- `ajvOptions` (object) (optional): Options to pass to [ajv](https://epoberezkin.github.io/ajv/)
  class constructor. Defaults are `{v5: true, coerceTypes: 'array', $data: true, allErrors: true, useDefaults: true, defaultLanguage: 'en'}`

### Sample Usage

Example for input validation:

```javascript
const middy = require('middy')
const { validator } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

const schema = {
  required: ['body', 'foo'],
  properties: {
    // this will pass validation
    body: {
      type: 'string'
    },
    // this won't as it won't be in the event
    foo: {
      type: 'string'
    }
  }
}

handler.use(
  validator({
    inputSchema: schema
  })
)

// invokes the handler, note that property foo is missing
const event = {
  body: JSON.stringify({ something: 'somethingelse' })
}
handler(event, {}, (err, res) => {
  expect(err.message).toEqual('Event object failed validation')
})
```

Example for output validation:

```javascript
const middy = require('middy')
const { validator } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

const schema = {
  required: ['body', 'statusCode'],
  properties: {
    body: {
      type: 'object'
    },
    statusCode: {
      type: 'number'
    }
  }
}

handler.use(validator({ outputSchema: schema }))

handler({}, {}, (err, response) => {
  expect(err).not.toBe(null)
  expect(err.message).toEqual('Response object failed validation')
  expect(response).not.toBe(null) // it doesn't destroy the response so it can be used by other middlewares
})
```

## [urlEncodeBodyParser](/src/middlewares/urlEncodeBodyParser.js)

Automatically parses HTTP requests with URL-encoded body (typically the result
of a form submit).

### Options

- `extended` (boolean) (optional): if `true` will use [`qs`](https://npm.im/qs) to parse
  the body of the request. By default is set to `false`

### Sample Usage

```javascript
const middy = require('middy')
const { urlEncodeBodyParser } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, event.body) // propagates the body as response
})

handler.use(urlEncodeBodyParser({ extended: false }))

// When Lambda runs the handler with a sample event...
const event = {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'frappucino=muffin&goat%5B%5D=scone&pond=moose'
}

handler(event, {}, (_, body) => {
  expect(body).toEqual({
    frappucino: 'muffin',
    'goat[]': 'scone',
    pond: 'moose'
  })
})
```

## [warmup](/src/middlewares/warmup.js)

Warmup middleware that helps to reduce the [cold-start issue](https://serverless.com/blog/keep-your-lambdas-warm/). Compatible by default with [`serverless-plugin-warmup`](https://www.npmjs.com/package/serverless-plugin-warmup), but it can be configured to suit your implementation.

This middleware allows you to specify a schedule to keep Lambdas that always need to be very responsive warmed-up. It does this by regularly invoking the Lambda, but will terminate early to avoid the actual handler logic from being run.

If you use [`serverless-plugin-warmup`](https://www.npmjs.com/package/serverless-plugin-warmup) the scheduling part is done by the plugin and you just have to attach the middleware to your "middyfied" handler. If you don't want to use the plugin you have to create the schedule yourself and define the `isWarmingUp` function to define wether the current event is a warmup event or an actual business logic execution.

### Options

- `isWarmingUp`: a function that accepts the `event` object as a parameter
  and returns `true` if the current event is a warmup event and `false` if it's a regular execution. The default function will check if the `event` object has a `source` property set to `serverless-plugin-warmup`.
- `onWarmup`: a function that gets executed before the handler exits in case of warmup. By default the function just prints: `Exiting early via warmup Middleware`.

### Sample usage

```javascript
const isWarmingUp = event => event.isWarmingUp === true
const onWarmup = event => console.log('I am just warming up', event)

const originalHandler = (event, context, cb) => {
  /* ... */
}

const handler = middy(originalHandler).use(
  warmup({
    isWarmingUp,
    onWarmup
  })
)
```

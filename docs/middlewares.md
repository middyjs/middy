# Middlewares documentation

## Available middlewares

 - [cors](#cors)
 - [doNotWaitForEmptyEventLoop](#donotwaitforemptyeventloop)
 - [httpErrorHandler](#httperrorhandler)
 - [jsonBodyParser](#jsonbodyparser)
 - [s3KeyNormalizer](#s3keynormalizer)
 - [validator](#validator)
 - [urlEncodeBodyParser](#urlencodebodyparser)


## [cors](/src/middlewares/cors.js)

Sets CORS headers (`Access-Control-Allow-Origin`), necessary for making cross-origin requests, to response object.

### Options

 - `origin` (string) (optional): origin to put in the header (default: "*")

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


## [httpErrorHandler](/src/middlewares/jsonBodyParser.js)

Automatically handles uncatched errors that are created with
[`http-errors`](https://npm.im/http-errors) and creates a proper HTTP response
for them (using the message and the status code provided by the error object).

It should be set as the last error handler.


### Sample usage

```javascript
const middy = require('middy')
const { httpErrorHandler } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  throw new createError.UnprocessableEntity()
})

handler
  .use(httpErrorHandler())

// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  expect(response).toEqual({
    statusCode: 422,
    body: 'Unprocessable Entity'
  })
})
```


## [jsonBodyParser](/src/middlewares/jsonBodyParser.js)

Automatically parses HTTP requests with JSON body and converts the body into an
object. Also handles gracefully broken JSON as UnprocessableEntity (422 errors)
if used in combination of `httpErrorHanler`.

It can also be used in combination of validator as a prior step to normalize the
event body input as an object so that the content can be validated.

```example
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
  body: JSON.stringify({foo: 'bar'})
}
handler(event, {}, (_, body) => {
  expect(body).toEqual({foo: 'bar'})
})
```


## [s3KeyNormalizer](/src/middlewares/s3KeyNormalizer.js)

Normalizes key names in s3 events.

S3 events like S3 PUT and S3 DELETE will contain in the event a list of the files
that were affected by the change.

In this list the file keys are encoded [in a very peculiar way](http://docs.aws.amazon.com/AmazonS3/latest/dev/notification-content-structure.html) (urlencoded and
space characters replaced by a `+`). It happens very often that you will use the
key directly to perform operation on the file using the AWS S3 sdk, in such case,
it's very easy to forget to decode the key correctly.

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

handler
  .use(s3KeyNormalizer())
```



## [validator](/src/middlewares/validator.js)

Automatically validates incoming events and outgoing responses against custom
schemas defined with the [JSON schema syntax](http://json-schema.org/).

If an incoming event failes validation a `BadRequest` error is raised.
If an outgoing response failes validation a `InternalServerError` error is
raised.

This middleware can be used in combination with
[`httpErrorHandler`](#httpErrorHandler) to automatically return the right
response to the user.

### Options

 - `inputSchema` (object) (optional): the JSON schema object that will be used
   to validate the input (`handler.event`) of the Lambda handler.
 - `outputSchema` (object) (optional): the JSON schema object that will be used
   to validate the output (`handler.response`) of the Lambda handler.

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

handler.use(validator({
  inputSchema: schema
}))

// invokes the handler, note that property foo is missing
const event = {
  body: JSON.stringify({something: 'somethingelse'})
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

handler.use(validator({outputSchema: schema}))

handler({}, {}, (err, response) => {
  expect(err).not.toBe(null)
  expect(err.message).toEqual('Response object failed validation')
  expect(response).not.toBe(null) // it doesn't destroy the response so it can be used by other middlewares
})
```

## [urlEncodeBodyParser](/src/middlewares/urlEncodeBodyParser.js)

Automatically parses HTTP requests with URL encoded body (typically the result
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

handler.use(urlencodedBodyParser({extended: false}))

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

## [doNotWaitForEmptyEventLoop](/src/middlewares/doNotWaitForEmptyEventLoop.js)

Sets `context.callbackWaitsForEmptyEventLoop` property to `false`. This will prevent lambda for timing out because of hanging connection

### Sample Usage

```javascript
const middy = require('middy')
const { doNotWaitForEmptyEventLoop } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(doNotWaitForEmptyEventLoop())

// When Lambda runs the handler it get context with callbackWaitsForEmptyEventLoop property set to false

handler(event, context, (_, response) => {
  expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
})
```

# Middlewares documentation

## Available middlewares

 - [httpErrorHandler](#httpErrorHandler)
 - [jsonBodyParser](#jsonBodyParser)
 - [validator](#validator)
 - [urlencodeBodyParser](#urlencodeBodyParser)


## [httpErrorHandler](/src/middlewares/jsonBodyParser.js)

Automatically handles uncatched errors that are created with
[`http-errors`](https://npm.im/http-errors) and creates a proper HTTP response
for them (using the message and the status code provided by the error object).

It should be set as the last error handler.


### Sample usage

```javascript
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

## [urlencodeBodyParser](/src/middlewares/urlencodeBodyParser.js)

Automatically parses HTTP requests with URL encoded body (typically the result
of a form submit).

### Options

 - `extended` (boolean) (optional): if `true` will use [`qs`](https://npm.im/qs) to parse
  the body of the request. By default is set to `false`

### Sample Usage

```javascript
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

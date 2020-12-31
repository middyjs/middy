import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import validator from '../index.js'

test('It should validate an incoming object', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  const schema = {
    type: 'object',
    required: ['body'],
    properties: {
      body: {
        type: 'string'
      }
    }
  }

  handler
    .use(validator({
      inputSchema: schema
    }))

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' })
  }

  const body = await handler(event)

  t.is(body, '{"foo":"bar"}')
})

test('It should handle invalid schema as a BadRequest', async (t) => {

  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  const schema = {
    type: 'object',
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
    body: JSON.stringify({ something: 'somethingelse' })
  }

  try {
    await handler(event)
  } catch (err) {
    t.is(err.message, 'Event object failed validation')
    t.deepEqual(err.details, [{
      dataPath: '',
      keyword: 'required',
      message: 'should have required property foo',
      params: { missingProperty: 'foo' },
      schemaPath: '#/required'
    }])
  }
})

test('It should handle invalid schema as a BadRequest in a different language', async (t) => {

  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  const schema = {
    type: 'object',
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
    preferredLanguage: 'fr',
    body: JSON.stringify({ something: 'somethingelse' })
  }

  try {
    await handler(event)
  } catch (err) {
    t.is(err.message, 'Event object failed validation')
    t.deepEqual(err.details, [{
      dataPath: '',
      keyword: 'required',
      message: 'requiert la propriété foo',
      params: { missingProperty: 'foo' },
      schemaPath: '#/required'
    }])
  }
})

test('It should handle invalid schema as a BadRequest in a different language (with normalization)', async (t) => {

  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  const schema = {
    type: 'object',
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
    preferredLanguage: 'pt',
    body: JSON.stringify({ something: 'somethingelse' })
  }

  try {
    await handler(event)
  } catch (err) {
    t.is(err.message, 'Event object failed validation')
    t.deepEqual(err.details, [{
      dataPath: '',
      keyword: 'required',
      message: 'deve ter a propriedade obrigatória foo',
      params: { missingProperty: 'foo' },
      schemaPath: '#/required'
    }])
  }
})

test('It should validate response', async (t) => {
  const expectedResponse = {
    body: 'Hello world',
    statusCode: 200
  }

  const handler = middy((event, context) => {
    return expectedResponse
  })

  const schema = {
    type: 'object',
    required: ['body', 'statusCode'],
    properties: {
      body: {
        type: 'string'
      },
      statusCode: {
        type: 'number'
      }
    }
  }

  handler.use(validator({ outputSchema: schema }))

  const response = await handler()

  t.deepEqual(response, expectedResponse)
})

test('It should make requests with invalid responses fail with an Internal Server Error', async (t) => {

  const handler = middy((event, context) => {
    return {}
  })

  const schema = {
    type: 'object',
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

  let response

  try {
    response = await handler()
  } catch (err) {
    t.not(err, null)
    t.is(err.message, 'Response object failed validation')
    t.not(response, null) // it doesn't destroy the response so it gets logged
  }
})

test('It should not allow bad email format', async (t) => {
  const schema = { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }
  const handler = middy((event, context) => {
    return {}
  })

  handler.use(validator({ inputSchema: schema }))

  try {
    // This same email is not a valid one in 'full' validation mode
    await handler({ email: 'abc@abc' })
  } catch (err) {
    t.is(err.details[0].message, 'should match format "email"')
  }
})

test('It should error when unsupported keywords used (input)', async (t) => {
  const schema = {
    type: 'object',
    somethingnew: 'should be an object with an integer property foo only'
  }

  const handler = middy((event, context) => {
    return {}
  })

  try {
    handler.use(validator({ inputSchema: schema }))
    await handler({ foo: 'a' })
  } catch (err) {
    t.is(err.message, 'strict mode: unknown keyword: "somethingnew"')
  }
})


test('It should error when unsupported keywords used (output)', async (t) => {
  const schema = {
    type: 'object',
    somethingnew: 'should be an object with an integer property foo only'
  }

  const handler = middy((event, context) => {
    return {}
  })

  try {
    handler.use(validator({ outputSchema: schema }))
    await handler({ foo: 'a' })
  } catch (err) {
    t.is(err.message, 'strict mode: unknown keyword: "somethingnew"')
  }
})

// TODO Not support yet with ajv v7
/*test('It should use out-of-the-box ajv-errors plugin', async (t) => {
  const schema = {
    type: 'object',
    required: ['foo'],
    properties: {
      foo: { type: 'integer' }
    },
    errorMessage: 'should be an object with an integer property foo only'
  }

  const handler = middy((event, context) => {
    return {}
  })

  handler.use(validator({ inputSchema: schema }))

  try {
    await handler({ foo: 'a' })
  } catch (err) {
    t.is(err.message, 'Event object failed validation')
    t.deepEqual(err.details, [{
      dataPath: '',
      keyword: 'errorMessage',
      params: {
        errors: [{
          dataPath: '/foo',
          emUsed: true,
          keyword: 'type',
          params: {
            type: 'integer',
          },
          schemaPath: '#/properties/foo/type'
        }]
      },
      schemaPath: '#/errorMessage',
      message: 'should be an object with an integer property foo only'
    }])
  }
})*/

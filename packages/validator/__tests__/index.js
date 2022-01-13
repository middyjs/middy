const test = require('ava')
const middy = require('../../core/index.js')
const validator = require('../index.js')

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('It should validate an incoming object', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  const schema = {
    type: 'object',
    required: ['body'],
    properties: {
      body: {
        type: 'object',
        properties: {
          string: {
            type: 'string'
          },
          boolean: {
            type: 'boolean'
          },
          integer: {
            type: 'integer'
          },
          number: {
            type: 'number'
          }
        }
      }
    }
  }

  handler.use(
    validator({
      inputSchema: schema
    })
  )

  // invokes the handler
  const event = {
    body: {
      string: JSON.stringify({ foo: 'bar' }),
      boolean: 'true',
      integer: '0',
      number: '0.1'
    }
  }

  const body = await handler(event, context)

  t.deepEqual(body, {
    boolean: true,
    integer: 0,
    number: 0.1,
    string: '{"foo":"bar"}'
  })
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

  handler.use(
    validator({
      inputSchema: schema
    })
  )

  // invokes the handler, note that property foo is missing
  const event = {
    body: JSON.stringify({ something: 'somethingelse' })
  }

  try {
    await handler(event, context)
  } catch (err) {
    t.is(err.message, 'Event object failed validation')
    t.deepEqual(err.details, [
      {
        instancePath: '',
        keyword: 'required',
        message: 'must have required property foo',
        params: { missingProperty: 'foo' },
        schemaPath: '#/required'
      }
    ])
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

  handler.use(
    validator({
      inputSchema: schema
    })
  )

  const cases = [
    { lang: 'fr', message: 'requiert la propriété foo' },
    { lang: 'zh', message: '应当有必需属性 foo' },
    { lang: 'zh-TW', message: '應該有必須屬性 foo' }
  ]

  for (const c of cases) {
    // invokes the handler, note that property foo is missing
    const event = {
      preferredLanguage: c.lang,
      body: JSON.stringify({ something: 'somethingelse' })
    }

    try {
      await handler(event, context)
    } catch (err) {
      t.is(err.message, 'Event object failed validation')
      t.deepEqual(err.details, [
        {
          instancePath: '',
          keyword: 'required',
          message: c.message,
          params: { missingProperty: 'foo' },
          schemaPath: '#/required'
        }
      ])
    }
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

  handler.use(
    validator({
      inputSchema: schema
    })
  )

  // invokes the handler, note that property foo is missing
  const event = {
    preferredLanguage: 'pt',
    body: JSON.stringify({ something: 'somethingelse' })
  }

  try {
    await handler(event, context)
  } catch (err) {
    t.is(err.message, 'Event object failed validation')
    t.deepEqual(err.details, [
      {
        instancePath: '',
        keyword: 'required',
        message: 'deve ter a propriedade obrigatória foo',
        params: { missingProperty: 'foo' },
        schemaPath: '#/required'
      }
    ])
  }
})

test('It should handle invalid schema as a BadRequest without i18n', async (t) => {
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

  handler.use(
    validator({
      inputSchema: schema,
      i18nEnabled: false
    })
  )

  // invokes the handler, note that property foo is missing
  const event = {
    preferredLanguage: 'pt',
    body: JSON.stringify({ something: 'somethingelse' })
  }

  try {
    await handler(event, context)
  } catch (err) {
    t.is(err.message, 'Event object failed validation')
    t.deepEqual(err.details, [
      {
        instancePath: '',
        keyword: 'required',
        params: { missingProperty: 'foo' },
        schemaPath: '#/required'
      }
    ])
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

  const response = await handler(event, context)

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
    response = await handler(event, context)
  } catch (err) {
    t.not(err, null)
    t.is(err.message, 'Response object failed validation')
    t.not(response, null) // it doesn't destroy the response so it gets logged
  }
})

test('It should not allow bad email format', async (t) => {
  const schema = {
    type: 'object',
    required: ['email'],
    properties: { email: { type: 'string', format: 'email' } }
  }
  const handler = middy((event, context) => {
    return {}
  })

  handler.use(validator({ inputSchema: schema }))

  const event = { email: 'abc@abc' }
  try {
    // This same email is not a valid one in 'full' validation mode
    await handler(event, context)
  } catch (err) {
    t.is(err.details[0].message, 'must match format "email"')
  }
})

test('It should error when unsupported keywords used (input)', async (t) => {
  const schema = {
    type: 'object',
    somethingnew: 'must be an object with an integer property foo only'
  }

  const handler = middy((event, context) => {
    return {}
  })

  const event = { foo: 'a' }
  try {
    handler.use(validator({ inputSchema: schema }))
    await handler(event, conext)
  } catch (err) {
    t.is(err.message, 'strict mode: unknown keyword: "somethingnew"')
  }
})

test('It should error when unsupported keywords used (output)', async (t) => {
  const schema = {
    type: 'object',
    somethingnew: 'must be an object with an integer property foo only'
  }

  const handler = middy((event, context) => {
    return {}
  })

  const event = { foo: 'a' }
  try {
    handler.use(validator({ outputSchema: schema }))
    await handler(event. context)
  } catch (err) {
    t.is(err.message, 'strict mode: unknown keyword: "somethingnew"')
  }
})

// TODO Not support yet with ajv v7
/* test('It should use out-of-the-box ajv-errors plugin', async (t) => {
  const schema = {
    type: 'object',
    required: ['foo'],
    properties: {
      foo: { type: 'integer' }
    },
    errorMessage: 'must be an object with an integer property foo only'
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
      instancePath: '',
      keyword: 'errorMessage',
      params: {
        errors: [{
          instancePath: '/foo',
          emUsed: true,
          keyword: 'type',
          params: {
            type: 'integer',
          },
          schemaPath: '#/properties/foo/type'
        }]
      },
      schemaPath: '#/errorMessage',
      message: 'must be an object with an integer property foo only'
    }])
  }
}) */

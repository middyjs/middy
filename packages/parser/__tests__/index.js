import test from 'ava'
import middy from '../../core/index.js'
import parser, {
  eventParsingErrorMessage,
  contextParsingErrorMessage,
  responseParsingErrorMessage
} from '../index.js'
import { z } from 'zod'

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000,
  callbackWaitsForEmptyEventLoop: true,
  functionVersion: '$LATEST',
  functionName: 'lambda',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/lambda',
  logStreamName: '2022/04/01/[$LATEST]7a7ac3439a3b4635ba18460a3c7cea81',
  clientContext: undefined,
  identity: undefined,
  invokedFunctionArn:
    'arn:aws:lambda:ca-central-1:000000000000:function:lambda',
  awsRequestId: '00000000-0000-0000-0000-0000000000000'
}
const contextSchema = z.object({
  getRemainingTimeInMillis: z.function(),
  functionVersion: z.string(),
  invokedFunctionArn: z.string(),
  memoryLimitInMB: z.string(),
  awsRequestId: z.string(),
  logGroupName: z.string(),
  logStreamName: z.string(),
  identity: z
    .object({
      cognitoIdentityId: z.string(),
      cognitoIdentityPoolId: z.string()
    })
    .optional(),
  clientContext: z
    .object({
      'client.installation_id': z.string(),
      'client.app_title': z.string(),
      'client.app_version_name': z.string(),
      'client.app_version_code': z.string(),
      'client.app_package_name': z.string(),
      'env.platform_version': z.string(),
      'env.platform': z.string(),
      'env.make': z.string(),
      'env.model': z.string(),
      'env.locale': z.string()
    })
    .optional(),
  callbackWaitsForEmptyEventLoop: z.boolean()
})

test('It should parse an event object', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  const eventSchema = z.object({
    body: z.object({
      string: z.string(),
      boolean: z.boolean(),
      integer: z.number().int(),
      number: z.number()
    })
  })

  handler.use(parser({ eventSchema }))

  // invokes the handler
  const event = {
    body: {
      string: JSON.stringify({ foo: 'bar' }),
      boolean: true,
      integer: 0,
      number: 0.1
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

test('It should parse an event object with formats', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  const eventSchema = z.object({
    body: z.object({
      datetime: z.string().datetime(),
      email: z.string().email(),
      url: z.string().url(),
      ipv4: z.string().ip({ version: 'v4' }),
      ipv6: z.string().ip({ version: 'v6' }),
      uuid: z.string().uuid()
    })
  })

  handler.use(parser({ eventSchema }))

  const event = {
    body: {
      datetime: '2020-01-01T00:00:00Z',
      url: 'https://example.org',
      email: 'username@example.org',
      ipv4: '127.0.0.1',
      ipv6: '2001:0db8:0000:0000:0000:ff00:0042:8329',
      uuid: '123e4567-e89b-12d3-a456-426614174000'
    }
  }

  const body = await handler(event, context)

  t.deepEqual(body, {
    datetime: '2020-01-01T00:00:00Z',
    url: 'https://example.org',
    email: 'username@example.org',
    ipv4: '127.0.0.1',
    ipv6: '2001:0db8:0000:0000:0000:ff00:0042:8329',
    uuid: '123e4567-e89b-12d3-a456-426614174000'
  })
})

test('It should handle invalid schema as a BadRequest', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  const eventSchema = z.object({
    body: z.string(),
    foo: z.string()
  })

  handler.use(parser({ eventSchema }))

  // invokes the handler, note that property foo is missing
  const event = {
    body: JSON.stringify({ something: 'somethingelse' })
  }

  try {
    await handler(event, context)
  } catch (e) {
    t.is(e.message, eventParsingErrorMessage)
    t.deepEqual(e.cause.issues, [
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['foo'],
        received: 'undefined'
      }
    ])
  }
})

test('It should parse context object', async (t) => {
  const expectedResponse = {
    body: 'Hello world',
    statusCode: 200
  }

  const handler = middy((event, context) => {
    return expectedResponse
  })

  handler.use(parser({ contextSchema }))

  const response = await handler(event, context)

  t.deepEqual(response, expectedResponse)
})

test('It should throw an Internal Server Error if invalid context', async (t) => {
  const handler = middy((event, context) => {
    return {}
  })

  handler
    .before((request) => {
      request.context.callbackWaitsForEmptyEventLoop = 'fail'
    })
    .use(parser({ contextSchema }))

  try {
    await handler(event, context)
  } catch (e) {
    t.not(e, null)
    t.is(e.message, contextParsingErrorMessage)
  }
})

test('It should parse response object', async (t) => {
  const expectedResponse = {
    body: 'Hello world',
    statusCode: 200
  }

  const handler = middy((event, context) => {
    return expectedResponse
  })

  const responseSchema = z.object({
    body: z.string(),
    statusCode: z.number()
  })

  handler.use(parser({ responseSchema }))

  const response = await handler(event, context)

  t.deepEqual(response, expectedResponse)
})

test('It should throw an Internal Server Error if invalid response', async (t) => {
  const handler = middy((event, context) => {
    return {}
  })

  const responseSchema = z.object({
    body: z.object({}),
    statusCode: z.object({})
  })

  handler.use(parser({ responseSchema }))

  try {
    await handler(event, context)
  } catch (e) {
    t.not(e, null)
    t.is(e.message, responseParsingErrorMessage)
  }
})

test('It should not allow bad email format', async (t) => {
  const eventSchema = z.object({
    email: z.string().email()
  })
  const handler = middy((event, context) => {
    return {}
  })

  handler.use(parser({ eventSchema }))

  const event = { email: 'abc@abc' }
  try {
    // This same email is not a valid one in 'full' validation mode
    await handler(event, context)
  } catch (e) {
    t.is(e.cause.issues[0].message, 'Invalid email')
  }
})

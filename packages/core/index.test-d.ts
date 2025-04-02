import { expectType, expectAssignable } from 'tsd'
import middy, { MiddyfiedHandler } from '.'
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  Handler as AWSLambdaHandler,
  S3Event
} from 'aws-lambda'

// extends Handler type from aws-lambda
type EnhanceHandlerType<T, NewReturn> = T extends (
  event: infer TEvent,
  context: infer TContextType,
  opts: infer TOptsType
) => infer R
  ? (event: TEvent, context: TContextType, opts: TOptsType) => R | NewReturn
  : never

type AWSLambdaHandlerWithoutCallback<TEvent = any, TResult = any> = (
  event: TEvent,
  context: Context
  // eslint-disable-next-line
) => void | Promise<TResult>

type LambdaHandler<TEvent = any, TResult = any> = EnhanceHandlerType<
AWSLambdaHandlerWithoutCallback<TEvent, TResult>,
TResult
>

const lambdaHandler: LambdaHandler<
APIGatewayProxyEvent,
APIGatewayProxyResult
> = async (event) => {
  return {
    statusCode: 200,
    body: `Hello from ${event.path}`
  }
}

type Handler = middy.MiddyfiedHandler<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error
>
type Request = middy.Request<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error,
Context
>

// initialize
let handler = middy(lambdaHandler)
expectType<Handler>(handler)

// initialize with empty plugin
handler = middy(lambdaHandler, {})
expectType<Handler>(handler)

// initialize with plugin with few hooks
handler = middy(lambdaHandler, {
  beforePrefetch () {
    console.log('beforePrefetch')
  }
})
expectType<Handler>(handler)

// initialize with plugin with all hooks
handler = middy(lambdaHandler, {
  beforePrefetch () {
    console.log('beforePrefetch')
  },
  requestStart () {
    console.log('requestStart')
  },
  beforeMiddleware (name: string) {
    console.log('beforeMiddleware', name)
  },
  afterMiddleware (name: string) {
    console.log('afterMiddleware', name)
  },
  beforeHandler () {
    console.log('beforeHandler')
  },
  afterHandler () {
    console.log('afterHandler')
  },
  async requestEnd () {
    console.log('requestEnd')
  }
})
expectType<Handler>(handler)

// middy wrapped handler should be assignable to aws-lambda handler type.
expectAssignable<AWSLambdaHandler<APIGatewayProxyEvent, APIGatewayProxyResult>>(
  handler
)

// Middy handlers third argument is an object containing a abort signal
middy((_event: any, _context: any, { signal }: { signal: AbortSignal }) =>
  expectType<AbortSignal>(signal)
)

// invokes the handler to test that it is callable
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
async function invokeHandler (): Promise<void | APIGatewayProxyResult> {
  const sampleEvent: APIGatewayProxyEvent = {
    resource: '/',
    path: '/',
    httpMethod: 'GET',
    requestContext: {
      resourcePath: '/',
      httpMethod: 'GET',
      path: '/Prod/',
      accountId: 'x',
      apiId: 'y',
      authorizer: {},
      protocol: 'p',
      identity: {
        accessKey: '',
        accountId: '',
        apiKey: '',
        apiKeyId: '',
        caller: '',
        clientCert: null,
        cognitoAuthenticationProvider: '',
        cognitoAuthenticationType: '',
        cognitoIdentityId: '',
        cognitoIdentityPoolId: '',
        principalOrgId: '',
        sourceIp: '',
        user: '',
        userAgent: '',
        userArn: ''
      },
      stage: '',
      requestId: '',
      requestTimeEpoch: 12345567,
      resourceId: ''
    },
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      Host: '70ixmpl4fl.execute-api.us-east-2.amazonaws.com',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
      'X-Amzn-Trace-Id': 'Root=1-5e66d96f-7491f09xmpl79d18acf3d050'
    },
    multiValueHeaders: {
      accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      ],
      'accept-encoding': ['gzip, deflate, br']
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    body: null,
    isBase64Encoded: false
  }
  const sampleContext: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: '',
    functionVersion: '',
    invokedFunctionArn: '',
    memoryLimitInMB: '234',
    awsRequestId: '',
    logGroupName: '',
    logStreamName: '',
    getRemainingTimeInMillis: (): number => 1,
    done: () => {},
    fail: (_) => {},
    succeed: () => {}
  }
  return await handler(sampleEvent, sampleContext)
}
invokeHandler().catch(console.error)

const middlewareObj = {
  before: (request: Request) => {
    console.log('Before', request)
  },
  after: (request: Request) => {
    console.log('After', request)
  },
  onError: (request: Request) => {
    console.log('OnError', request)
  }
}

// use with 1 middleware
handler = handler.use(middlewareObj)
expectType<Handler>(handler)

// use with array of middlewares
handler = handler.use([middlewareObj])
expectType<Handler>(handler)

// before
handler = handler.before((request: Request) => {
  console.log('Before', request)
})
expectType<Handler>(handler)

// after
handler = handler.after((request: Request) => {
  console.log('After', request)
})
expectType<Handler>(handler)

// error
handler = handler.onError((request: Request) => {
  console.log('OnError', request)
})
expectType<Handler>(handler)

interface MutableContext extends Context {
  name: string
}

type MutableContextHandler = middy.MiddyfiedHandler<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error,
MutableContext
>
type MutableContextRequest = middy.Request<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error,
MutableContext
>

async function mutableContextDependantHandler (
  event: APIGatewayProxyEvent,
  context: MutableContext
): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: `Hello from ${context.name}`
  }
}

let customCtxHandler = middy<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error,
MutableContext
>(mutableContextDependantHandler)
expectType<MutableContextHandler>(customCtxHandler)

// @ts-expect-error
customCtxHandler = middy<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error,
Context
>(
  // @ts-expect-error
  mutableContextDependantHandler
)

const mutableContextMiddleware = {
  before: (request: MutableContextRequest) => {
    request.context.name = 'Foo'
  }
}

customCtxHandler = customCtxHandler.use(mutableContextMiddleware)
expectType<MutableContextHandler>(customCtxHandler)

const typeErrorMiddleware = {
  before: (request: MutableContextRequest) => {
    // @ts-expect-error
    request.context.test = 'Bar'
  }
}

customCtxHandler = customCtxHandler.use(typeErrorMiddleware)
expectType<MutableContextHandler>(customCtxHandler)

const streamifiedResponseHandler = middy({ streamifyResponse: true })
expectType<middy.MiddyfiedHandler<unknown>>(streamifiedResponseHandler)

streamifiedResponseHandler.handler(lambdaHandler)
streamifiedResponseHandler.use(middlewareObj)

// synced handler
const syncedLambdaHandler: LambdaHandler<
APIGatewayProxyEvent,
APIGatewayProxyResult
> = (event) => {
  return {
    statusCode: 200,
    body: `Hello from ${event.path}`
  }
}

// initialize
let syncedHandler = middy(syncedLambdaHandler)
expectType<Handler>(syncedHandler)

// initialize with empty plugin
syncedHandler = middy(syncedLambdaHandler, {})
expectType<Handler>(syncedHandler)

// initialize with plugin with few hooks
syncedHandler = middy(syncedLambdaHandler, {
  beforePrefetch () {
    console.log('beforePrefetch')
  }
})
expectType<Handler>(syncedHandler)

// initialize with plugin with all hooks
syncedHandler = middy(syncedLambdaHandler, {
  beforePrefetch () {
    console.log('beforePrefetch')
  },
  requestStart () {
    console.log('requestStart')
  },
  beforeMiddleware (name: string) {
    console.log('beforeMiddleware', name)
  },
  afterMiddleware (name: string) {
    console.log('afterMiddleware', name)
  },
  beforeHandler () {
    console.log('beforeHandler')
  },
  afterHandler () {
    console.log('afterHandler')
  },
  async requestEnd () {
    console.log('requestEnd')
  }
})
expectType<Handler>(syncedHandler)

// invokes the handler to test that it is callable
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
async function invokSyncedHandler (): Promise<void | APIGatewayProxyResult> {
  const sampleEvent: APIGatewayProxyEvent = {
    resource: '/',
    path: '/',
    httpMethod: 'GET',
    requestContext: {
      resourcePath: '/',
      httpMethod: 'GET',
      path: '/Prod/',
      accountId: 'x',
      apiId: 'y',
      authorizer: {},
      protocol: 'p',
      identity: {
        accessKey: '',
        accountId: '',
        apiKey: '',
        apiKeyId: '',
        caller: '',
        clientCert: null,
        cognitoAuthenticationProvider: '',
        cognitoAuthenticationType: '',
        cognitoIdentityId: '',
        cognitoIdentityPoolId: '',
        principalOrgId: '',
        sourceIp: '',
        user: '',
        userAgent: '',
        userArn: ''
      },
      stage: '',
      requestId: '',
      requestTimeEpoch: 12345567,
      resourceId: ''
    },
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      Host: '70ixmpl4fl.execute-api.us-east-2.amazonaws.com',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
      'X-Amzn-Trace-Id': 'Root=1-5e66d96f-7491f09xmpl79d18acf3d050'
    },
    multiValueHeaders: {
      accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      ],
      'accept-encoding': ['gzip, deflate, br']
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    body: null,
    isBase64Encoded: false
  }
  const sampleContext: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: '',
    functionVersion: '',
    invokedFunctionArn: '',
    memoryLimitInMB: '234',
    awsRequestId: '',
    logGroupName: '',
    logStreamName: '',
    getRemainingTimeInMillis: (): number => 1,
    done: () => {},
    fail: (_) => {},
    succeed: () => {}
  }
  return await syncedHandler(sampleEvent, sampleContext)
}
invokSyncedHandler().catch(console.error)

// use with 1 middleware
syncedHandler = syncedHandler.use(middlewareObj)
expectType<Handler>(syncedHandler)

// use with array of middlewares
syncedHandler = syncedHandler.use([middlewareObj])
expectType<Handler>(syncedHandler)

// before
syncedHandler = syncedHandler.before((request: Request) => {
  console.log('Before', request)
})
expectType<Handler>(syncedHandler)

// after
syncedHandler = syncedHandler.after((request: Request) => {
  console.log('After', request)
})
expectType<Handler>(syncedHandler)

// error
syncedHandler = syncedHandler.onError((request: Request) => {
  console.log('OnError', request)
})
expectType<Handler>(syncedHandler)

interface MutableContext extends Context {
  name: string
}

function syncedMutableContextDependantHandler (
  event: APIGatewayProxyEvent,
  context: MutableContext
): APIGatewayProxyResult {
  return {
    statusCode: 200,
    body: `Hello from ${context.name}`
  }
}

let customSyncedCtxHandler = middy<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error,
MutableContext
>(syncedMutableContextDependantHandler)
expectType<MutableContextHandler>(customSyncedCtxHandler)

// @ts-expect-error
customSyncedCtxHandler = middy<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error,
Context
>(
  // @ts-expect-error
  syncedMutableContextDependantHandler
)

const mutableSyncedContextMiddleware = {
  before: (request: MutableContextRequest) => {
    request.context.name = 'Foo'
  }
}

customSyncedCtxHandler = customSyncedCtxHandler.use(
  mutableSyncedContextMiddleware
)
expectType<MutableContextHandler>(customSyncedCtxHandler)

const syncedTypeErrorMiddleware = {
  before: (request: MutableContextRequest) => {
    // @ts-expect-error
    request.context.test = 'Bar'
  }
}

customSyncedCtxHandler = customSyncedCtxHandler.use(syncedTypeErrorMiddleware)
expectType<MutableContextHandler>(customSyncedCtxHandler)

const syncedStreamifiedResponseHandler = middy({ streamifyResponse: true })
expectType<middy.MiddyfiedHandler<unknown>>(syncedStreamifiedResponseHandler)

syncedStreamifiedResponseHandler.handler(syncedLambdaHandler)
syncedStreamifiedResponseHandler.use(middlewareObj)

// Issue #1176
const baseHandler: AWSLambdaHandler = async (event) => {
  console.log('Hello world')
}

const handler1176 = middy(baseHandler)
expectType<MiddyfiedHandler<any, any, Error, Context, {}>>(handler1176)

// Issue #1182
const s3Handler = async (event: S3Event): Promise<void> => {
  await Promise.all(event.Records.map(async () => await Promise.resolve()))
}

const handler1182 = middy().handler(s3Handler)
expectType<MiddyfiedHandler<S3Event, any, Error, Context, {}>>(handler1182)

//  Issue #1228 Correct return type
const numberHandler = middy<APIGatewayProxyEvent, number>().handler(
  async (event) => {
    return 42 // Correct return type, should pass type checking
  }
)
expectType<middy.MiddyfiedHandler<APIGatewayProxyEvent, number>>(numberHandler)

//  Issue #1228 Incorrect return type
const invalidNumberHandler = middy<APIGatewayProxyEvent, number>()
  // @ts-expect-error
  .handler(async () => {
    return 'not a number'
  })
expectType<middy.MiddyfiedHandler<APIGatewayProxyEvent, number>>(
  invalidNumberHandler
)

// Issue #1275 Early Response type
middy<unknown, string>()
  .before(async (request) => {
    request.earlyResponse = 'Hello, world!'
  })
  .use({
    after: (request) => {
      request.earlyResponse = null
    }
  })
  .onError(async (request) => {
    request.earlyResponse = undefined
  })

// Test for correct type intersection with middleware arrays (issue #1289)
interface EventTypeA {
  propA: string
}

interface EventTypeB {
  propB: number
}

// Mock middleware objects with specific event types
const middlewareWithEventA: middy.MiddlewareObj<EventTypeA> = {
  before: (request) => {}
}

const middlewareWithEventB: middy.MiddlewareObj<EventTypeB> = {
  before: (request) => {}
}

const handlerTypeTest1 = middy()
  .use(middlewareWithEventA)
  .use(middlewareWithEventB)
  .handler((event) => {
    expectType<string>(event.propA)
    expectType<number>(event.propB)
    return {}
  })

expectType<
middy.MiddyfiedHandler<EventTypeA & EventTypeB, any, Error, Context, {}>
>(handlerTypeTest1)

const handlerTypeTest2 = middy()
  .use([middlewareWithEventA, middlewareWithEventB])
  .handler((event) => {
    expectType<string>(event.propA)
    expectType<number>(event.propB)
    return {}
  })

expectType<
middy.MiddyfiedHandler<EventTypeA & EventTypeB, any, Error, Context, {}>
>(handlerTypeTest2)

const handlerTypeTest3 = middy()
  .use(middlewareWithEventA)
  .use([middlewareWithEventB])
  .handler((event) => {
    expectType<string>(event.propA)
    expectType<number>(event.propB)
    return {}
  })

expectType<
middy.MiddyfiedHandler<EventTypeA & EventTypeB, any, Error, Context, {}>
>(handlerTypeTest3)

const handlerTypeTest4 = middy()
  .use(middlewareWithEventA)
  .handler((event) => {
    expectType<string>(event.propA)
    return {}
  })

expectType<middy.MiddyfiedHandler<EventTypeA, any, Error, Context, {}>>(
  handlerTypeTest4
)

interface EventTypeC {
  propC: boolean
}

interface InternalA {
  internalProp: string
}

interface InternalB {
  internalProp: number
}

const handlerTypeTest5 = middy()
  .use(middlewareWithEventA)
  .use<middy.MiddlewareObj<EventTypeC, any, Error, Context, InternalA>>({
  before: (event) => {}
})
  .use<middy.MiddlewareObj<EventTypeC, any, Error, Context, InternalB>>({
  before: (event) => {}
})
  .use({
    before: (event) => {
      // TODO: make this work
      // event.propB
    }
  })
  .use([middlewareWithEventB])
  .handler((event) => {
    expectType<string>(event.propA)
    expectType<number>(event.propB)
    return {}
  })

expectType<
middy.MiddyfiedHandler<
EventTypeA & EventTypeC & EventTypeB,
any,
Error,
Context,
InternalA & InternalB
>
>(handlerTypeTest5)

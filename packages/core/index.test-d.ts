import { expectType } from 'tsd'
import middy from '.'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'

async function baseHandler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: `Hello from ${event.path}`
  }
}

type Handler = middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult, Error>
type Request = middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error, Context>

// initialize
let handler = middy(baseHandler)
expectType<Handler>(handler)

// initialize with empty plugin
handler = middy(baseHandler, {})
expectType<Handler>(handler)

// initialize with plugin with few hooks
handler = middy(baseHandler, {
  beforePrefetch () { console.log('beforePrefetch') }
})
expectType<Handler>(handler)

// initialize with plugin with all hooks
handler = middy(baseHandler, {
  beforePrefetch () { console.log('beforePrefetch') },
  requestStart () { console.log('requestStart') },
  beforeMiddleware (name: string) { console.log('beforeMiddleware', name) },
  afterMiddleware (name: string) { console.log('afterMiddleware', name) },
  beforeHandler () { console.log('beforeHandler') },
  afterHandler () { console.log('afterHandler') },
  async requestEnd () { console.log('requestEnd') }
})
expectType<Handler>(handler)

// invokes the handler to test that it is callable
async function invokeHandler (): Promise<APIGatewayProxyResult> {
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
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      Host: '70ixmpl4fl.execute-api.us-east-2.amazonaws.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
      'X-Amzn-Trace-Id': 'Root=1-5e66d96f-7491f09xmpl79d18acf3d050'
    },
    multiValueHeaders: {
      accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      ],
      'accept-encoding': [
        'gzip, deflate, br'
      ]
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
    done: () => { },
    fail: (_) => { },
    succeed: () => { }
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

// applyMiddleware
handler = handler.applyMiddleware(middlewareObj)
expectType<Handler>(handler)

// before
handler = handler.before((request: Request) => { console.log('Before', request) })
expectType<Handler>(handler)

// after
handler = handler.after((request: Request) => { console.log('After', request) })
expectType<Handler>(handler)

// error
handler = handler.onError((request: Request) => { console.log('OnError', request) })
expectType<Handler>(handler)

// check middlewares list
expectType<{
  before: Array<middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult, Error>>
  after: Array<middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult, Error>>
  onError: Array<middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult, Error>>
}>(handler.__middlewares)

interface MutableContext extends Context {
  name: string
}

type MutableContextHandler = middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult, Error, MutableContext>
type MutableContextRequest = middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error, MutableContext>

async function mutableContextDependantHandler (event: APIGatewayProxyEvent, context: MutableContext): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: `Hello from ${context.name}`
  }
}

let customCtxHandler = middy<APIGatewayProxyEvent, APIGatewayProxyResult, Error, MutableContext>(mutableContextDependantHandler)
expectType<MutableContextHandler>(customCtxHandler)

// @ts-expect-error
customCtxHandler = middy<APIGatewayProxyEvent, APIGatewayProxyResult, Error, Context>(mutableContextDependantHandler)

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

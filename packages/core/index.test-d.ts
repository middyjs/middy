import { expectType } from 'tsd'
import middy from '.'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

async function baseHandler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: `Hello from ${event.path}`
  }
}

type Handler = middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult, Error>
type Request = middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error>

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

import { expectType } from 'tsd'
import middy from '.'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

async function baseHandler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: `Hello from ${event.path}`
  }
}

type Handler = middy.Middy<APIGatewayProxyEvent, APIGatewayProxyResult, Error>

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
  before: (handler: Handler) => {
    console.log('Before', handler)
  },
  after: (handler: Handler) => {
    console.log('After', handler)
  },
  onError: (handler: Handler) => {
    console.log('OnError', handler)
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
handler = handler.before((handler: Handler) => { console.log('Before', handler) })
expectType<Handler>(handler)

// after
handler = handler.after((handler: Handler) => { console.log('After', handler) })
expectType<Handler>(handler)

// error
handler = handler.onError((handler: Handler) => { console.log('OnError', handler) })
expectType<Handler>(handler)

// check middlewares list
expectType<{
  before: Array<middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult, Error>>
  after: Array<middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult, Error>>
  onError: Array<middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult, Error>>
}>(handler.__middlewares)

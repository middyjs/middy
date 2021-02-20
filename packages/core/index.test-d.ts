import { expectType } from 'tsd'
import middy from '.'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

async function baseHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: `Hello from ${event.path}`
  }
}

type Handler = middy.Middy<APIGatewayProxyEvent, APIGatewayProxyResult, Error>

// initialize
let handler = middy(baseHandler)
expectType<Handler>(handler)

// use with 1 middleware
handler = handler.use({
  before: (handler: Handler) => {
    console.log('Before', handler)
  },
  after: (handler: Handler) => {
    console.log('After', handler)
  },
  onError: (handler: Handler) => {
    console.log('OnError', handler)
  },
})
expectType<Handler>(handler)


// use with array of middlewares
handler = handler.use([{
  before: (handler: Handler) => {
    console.log('Before', handler)
  },
  after: (handler: Handler) => {
    console.log('After', handler)
  },
  onError: (handler: Handler) => {
    console.log('OnError', handler)
  },
}])
expectType<Handler>(handler)

// before
handler.before(function (handler: Handler) {
  console.log('Before', handler)
})

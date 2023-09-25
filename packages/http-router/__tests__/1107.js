import middy from '../../core/index.js'
import httpRouterHandler from '../../http-router/index.js'
import httpHeaderNormalizer from '../../http-header-normalizer/index.js'
import validator from '../../validator/index.js'
import { transpileSchema } from '../../validator/transpile.js'

const eventSchema = {
  type: 'object',
  required: ['body', 'foo'],
  properties: {
    // this will pass validation
    body: {
      type: 'string'
    }
  }
}

const getBookHandler = middy()
  .use(httpHeaderNormalizer())

  .handler((event, context) => {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'get Book'
      })
    }
  })

const postBookHandler = middy()
  .use(
    validator({
      eventSchema: transpileSchema(eventSchema, { strict: false })
    })
  )
  .handler((event, context) => {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'post Book'
      })
    }
  })

const postBookContentHandler = middy()
  .use(httpHeaderNormalizer())
  .handler((event, context) => {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'post Book Content'
      })
    }
  })

const routes = [
  {
    method: 'GET',
    path: '/book',
    handler: getBookHandler
  },
  {
    method: 'POST',
    path: '/book',
    handler: postBookHandler
  },
  {
    method: 'POST',
    path: '/book/contents',
    handler: postBookContentHandler
  }
]

export const handler = middy()
  .use(httpHeaderNormalizer()) // Apply httpHeaderNormalizer to the main handler
  .handler(httpRouterHandler(routes))

console.log(
  await handler(
    {
      httpMethod: 'GET',
      path: '/book'
    },
    {}
  )
)

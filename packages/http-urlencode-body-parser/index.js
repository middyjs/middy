// import { createError } from '@middy/util'
import parse from 'qs/lib/parse.js'
// import {parse} from 'node:querystring' // parse(body, undefined, undefined, { maxKeys:0 })

const mimePattern = /^application\/x-www-form-urlencoded(;.*)?$/

const httpUrlencodeBodyParserMiddlewareBefore = async (request) => {
  const { headers, body } = request.event
  const contentType = headers['Content-Type'] ?? headers['content-type']

  if (!mimePattern.test(contentType)) return

  const data = request.event.isBase64Encoded
    ? Buffer.from(body, 'base64').toString()
    : body
  request.event.rawBody = body
  request.event.body = parse(data)
  // v4 breaking change
  /* if (typeof request.event.body === 'string') {
    // UnprocessableEntity
    // throw createError(422, 'Invalid or malformed URL encoded form was provided', { cause })
    const error = createError(422, 'Invalid or malformed URL encoded form was provided', { cause: '@middy/http-urlencode-body-parser unable to parse body' })
    throw error
  } */
}

const httpUrlencodeBodyParserMiddleware = () => ({
  before: httpUrlencodeBodyParserMiddlewareBefore
})
export default httpUrlencodeBodyParserMiddleware

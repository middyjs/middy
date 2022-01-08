const httpUrlencodePathParserMiddlewareBefore = async (request) => {
  if (!request.event.pathParameters) return
  for (const key in request.event.pathParameters) {
    request.event.pathParameters[key] = decodeURIComponent(
      request.event.pathParameters[key]
    )
  }
}

const httpUrlencodePathParserMiddleware = () => ({
  before: httpUrlencodePathParserMiddlewareBefore
})
module.exports = httpUrlencodePathParserMiddleware

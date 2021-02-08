const httpUrlencodePathParserMiddlewareBefore = async (handler) => {
  if (!handler.event?.pathParameters) return
  for (const key in handler.event.pathParameters) {
    handler.event.pathParameters[key] = decodeURIComponent(
      handler.event.pathParameters[key]
    )
  }
}

module.exports = () => ({
  before: httpUrlencodePathParserMiddlewareBefore
})

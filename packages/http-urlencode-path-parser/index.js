const httpUrlencodePathParserMiddlewareBefore = async (handler) => {
  if (!handler.event?.pathParameters) return
  for (const key in handler.event.pathParameters) {
    try {
      handler.event.pathParameters[key] = decodeURIComponent(handler.event.pathParameters[key])
    } catch (e) {
      throw e
    }
  }
}

export default () => ({
  before: httpUrlencodePathParserMiddlewareBefore
})

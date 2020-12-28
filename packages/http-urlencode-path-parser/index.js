
const httpUrlencodePathParserMiddlewareBefore = async (handler) => {
  if (handler.event.pathParameters) {
    for (const key in handler.event.pathParameters) {
      try {
        handler.event.pathParameters[key] = decodeURIComponent(handler.event.pathParameters[key])
      } catch (e) {
        throw new Error(e.message)
      }
    }
  }
}

export default () => ({
  before: httpUrlencodePathParserMiddlewareBefore
})

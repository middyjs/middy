import contentType from 'content-type'
import { parse } from 'qs'

const httpUrlencodeBodyParserMiddlewareBefore = async (handler) => {
  if (!handler.event?.headers) return
  const contentTypeHeader = handler.event.headers?.['content-type'] ?? handler.event.headers?.['Content-Type']
  if (!contentTypeHeader) return
  const { type } = contentType.parse(contentTypeHeader)

  if (type === 'application/x-www-form-urlencoded') {
    handler.event.body = parse(handler.event.body)
  }
}

export default () => ({
  before: httpUrlencodeBodyParserMiddlewareBefore
})

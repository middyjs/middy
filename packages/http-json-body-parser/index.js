import createError from 'http-errors'
import contentType from 'content-type'

const defaults = {}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)
  const httpJsonBodyParserMiddlewareBefore = async (handler) => {
    if (handler.event.headers) {
      const contentTypeHeader = handler.event.headers['content-type'] || handler.event.headers['Content-Type']
      if (contentTypeHeader) {
        const { type } = contentType.parse(contentTypeHeader)
        if (type.match(/^application\/(.*\+)?json$/)) {
          try {
            const data = handler.event.isBase64Encoded
              ? Buffer.from(handler.event.body, 'base64').toString()
              : handler.event.body

            handler.event.body = JSON.parse(data, options.reviver)
          } catch (err) {
            throw new createError.UnprocessableEntity('Content type defined as JSON but an invalid JSON was provided')
          }
        }
      }
    }
  }

  return {
    before: httpJsonBodyParserMiddlewareBefore
  }
}

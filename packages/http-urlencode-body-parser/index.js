import contentType from 'content-type'
import {parse } from 'qs'

export default () => {
  return {
    before: async (handler) => {
      if (handler.event.headers) {
        const contentTypeHeader = handler.event.headers['content-type'] || handler.event.headers['Content-Type']
        if (contentTypeHeader) {
          const { type } = contentType.parse(contentTypeHeader)

          if (type === 'application/x-www-form-urlencoded') {
            handler.event.body = parse(handler.event.body)
          }
        }
      }
    }
  }
}

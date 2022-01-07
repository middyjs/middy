import { normalizeHttpResponse } from '@middy/util'

const defaults = {
  logger: console.log // example
}

const basicMiddleware = (opts) => {
  const options = { ...defaults, ...opts }

  const basicMiddlewareBefore = async (request) => {
    const { event, context } = request
    // ...
    if (typeof options.logger === 'function') {
      options.logger(event, context)
    }
  }

  const basicMiddlewareAfter = async (request) => {
    normalizeHttpResponse(request)
    const { response } = request
    // ...
    request.response = response
  }

  const basicMiddlewareOnError = async (request) => {
    if (request.response === undefined) return
    return basicMiddlewareAfter(request)
  }

  return {
    before: basicMiddlewareBefore,
    after: basicMiddlewareAfter,
    onError: basicMiddlewareOnError
  }
}

export default basicMiddleware

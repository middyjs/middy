
const defaults = {

}

const basicMiddleware = (opts) => {
  const options = { ...defaults, ...opts }

  const basicMiddlewareBefore = async (request) => {
    const { event, context } = request
    // ...
  }

  const basicMiddlewareAfter = async (request) => {
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

module.exports = basicMiddleware

const mask = require('json-mask')

const defaults = {
  filteringKeyName: 'fields'
}

const httpPartialResponseMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const { filteringKeyName } = options

  const httpPartialResponseMiddlewareAfter = async (request) => {
    let body = request.response?.body
    if (!body) return

    const fields = request.event?.queryStringParameters?.[filteringKeyName]
    if (!fields) return

    let isBodyStringified
    try {
      body = JSON.parse(body)
      isBodyStringified = true
    } catch (e) {
      if (typeof body !== 'object') return
    }

    const filteredBody = mask(body, fields)

    request.response.body = isBodyStringified
      ? JSON.stringify(filteredBody)
      : filteredBody
  }
  return {
    after: httpPartialResponseMiddlewareAfter
  }
}
module.exports = httpPartialResponseMiddleware

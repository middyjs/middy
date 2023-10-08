import mask from 'json-mask'
import { normalizeHttpResponse, jsonSafeParse } from '@middy/util'
const defaults = {
  filteringKeyName: 'fields'
}
const httpPartialResponseMiddleware = (opts = {}) => {
  const options = {
    ...defaults,
    ...opts
  }
  const { filteringKeyName } = options
  const httpPartialResponseMiddlewareAfter = async (request) => {
    const fields = request.event?.queryStringParameters?.[filteringKeyName]
    if (!fields) return
    normalizeHttpResponse(request)
    const body = request.response.body
    const bodyIsString = typeof body === 'string'
    const parsedBody = jsonSafeParse(body)
    if (typeof parsedBody !== 'object') return
    const filteredBody = mask(parsedBody, fields)
    request.response.body = bodyIsString
      ? JSON.stringify(filteredBody)
      : filteredBody
  }
  return {
    after: httpPartialResponseMiddlewareAfter
  }
}
export default httpPartialResponseMiddleware

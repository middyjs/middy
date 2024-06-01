import { normalizeHttpResponse } from '@middy/util'

const defaults = {
  disableBeforePreflightResponse: true,
  getOrigin: undefined, // default inserted below
  credentials: undefined,
  headers: undefined,
  methods: undefined,
  origin: '*',
  origins: [],
  exposeHeaders: undefined,
  maxAge: undefined,
  requestHeaders: undefined,
  requestMethods: undefined,
  cacheControl: undefined,
  vary: undefined
}
const httpCorsMiddleware = (opts = {}) => {
  let originAny = false
  const originStatic = {}
  const originDynamic = []
  const getOrigin = (incomingOrigin, options = {}) => {
    if (options.origins.length > 0) {
      if (originStatic[incomingOrigin]) {
        return incomingOrigin
      }
      if (originAny) {
        if (options.credentials) {
          return incomingOrigin
        } else {
          return '*'
        }
      }
      if (originDynamic.some((regExp) => regExp.test(incomingOrigin))) {
        return incomingOrigin
      }
      // TODO deprecate `else` in v6
    } else {
      if (incomingOrigin && options.credentials && options.origin === '*') {
        return incomingOrigin
      }
      return options.origin
    }
    return null
  }
  const options = {
    ...defaults,
    getOrigin,
    ...opts
  }

  for (const origin of options.origins) {
    // Static
    if (origin.indexOf('*') < 0) {
      originStatic[origin] = true
      continue
    }
    // All
    if (origin === '*') {
      originAny = true
      continue
    }
    // Dynamic
    // TODO: IDN -> puncycode not handled, add in if requested
    const regExpStr = origin.replaceAll('.', '\\.').replaceAll('*', '[^.]*')
    originDynamic.push(new RegExp(`^${regExpStr}$`))
  }

  const httpCorsMiddlewareBefore = async (request) => {
    if (options.disableBeforePreflightResponse) return

    const method = getVersionHttpMethod[request.event.version ?? '1.0']?.(
      request.event
    )
    if (method === 'OPTIONS') {
      normalizeHttpResponse(request)
      const headers = {}
      modifyHeaders(headers, options, request)
      request.response.headers = headers
      request.response.statusCode = 204
      return request.response
    }
  }

  const httpCorsMiddlewareAfter = async (request) => {
    normalizeHttpResponse(request)
    const { headers } = request.response
    modifyHeaders(headers, options, request)
    request.response.headers = headers
  }
  const httpCorsMiddlewareOnError = async (request) => {
    if (request.response === undefined) return
    await httpCorsMiddlewareAfter(request)
  }
  return {
    before: httpCorsMiddlewareBefore,
    after: httpCorsMiddlewareAfter,
    onError: httpCorsMiddlewareOnError
  }
}
const getVersionHttpMethod = {
  '1.0': (event) => event.httpMethod,
  '2.0': (event) => event.requestContext.http.method
}

const modifyHeaders = (headers, options, request) => {
  const existingHeaders = Object.keys(headers)
  if (existingHeaders.includes('Access-Control-Allow-Credentials')) {
    options.credentials = headers['Access-Control-Allow-Credentials'] === 'true'
  }
  if (options.credentials) {
    headers['Access-Control-Allow-Credentials'] = String(options.credentials)
  }
  if (
    options.headers &&
    !existingHeaders.includes('Access-Control-Allow-Headers')
  ) {
    headers['Access-Control-Allow-Headers'] = options.headers
  }
  if (
    options.methods &&
    !existingHeaders.includes('Access-Control-Allow-Methods')
  ) {
    headers['Access-Control-Allow-Methods'] = options.methods
  }
  if (!existingHeaders.includes('Access-Control-Allow-Origin')) {
    const eventHeaders = request.event.headers ?? {}
    const incomingOrigin = eventHeaders.Origin ?? eventHeaders.origin
    const newOrigin = options.getOrigin(incomingOrigin, options)
    if (newOrigin) {
      headers['Access-Control-Allow-Origin'] = newOrigin
    }
  }
  let vary = options.vary
  if (
    headers['Access-Control-Allow-Origin'] &&
    headers['Access-Control-Allow-Origin'] !== '*' &&
    !vary
  ) {
    vary = 'Origin'
  }
  if (vary && !existingHeaders.includes('Vary')) {
    headers.Vary = vary
  }
  if (
    options.exposeHeaders &&
    !existingHeaders.includes('Access-Control-Expose-Headers')
  ) {
    headers['Access-Control-Expose-Headers'] = options.exposeHeaders
  }
  if (options.maxAge && !existingHeaders.includes('Access-Control-Max-Age')) {
    headers['Access-Control-Max-Age'] = String(options.maxAge)
  }
  if (
    options.requestHeaders &&
    !existingHeaders.includes('Access-Control-Request-Headers')
  ) {
    headers['Access-Control-Request-Headers'] = options.requestHeaders
  }
  if (
    options.requestMethods &&
    !existingHeaders.includes('Access-Control-Request-Methods')
  ) {
    headers['Access-Control-Request-Methods'] = options.requestMethods
  }
  const httpMethod = getVersionHttpMethod[request.event.version ?? '1.0']?.(
    request.event
  )
  if (
    httpMethod === 'OPTIONS' &&
    options.cacheControl &&
    !existingHeaders.includes('Cache-Control')
  ) {
    headers['Cache-Control'] = options.cacheControl
  }
}

export default httpCorsMiddleware

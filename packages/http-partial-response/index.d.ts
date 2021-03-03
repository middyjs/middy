import middy from '@middy/core'

interface Options {
  filteringKeyName?: string
}

declare function httpPartialResponse (options?: Options): middy.MiddlewareObj

export default httpPartialResponse

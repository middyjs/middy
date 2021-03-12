import middy from '@middy/core'

interface Options {
  logger?: (error: any) => void
}

declare function errorLogger (options?: Options): middy.MiddlewareObj

export default errorLogger

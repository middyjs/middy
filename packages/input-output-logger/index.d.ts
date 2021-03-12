import middy from '@middy/core'

interface Options {
  logger?: (message: any) => void
  omitPaths?: string[]
}

declare function inputOutputLogger (options?: Options): middy.MiddlewareObj

export default inputOutputLogger

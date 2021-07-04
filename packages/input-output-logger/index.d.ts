import middy from '@middy/core'

interface Options {
  logger?: (message: any) => void
  awsContext?: boolean
  omitPaths?: string[]
}

declare function inputOutputLogger (options?: Options): middy.MiddlewareObj

export default inputOutputLogger

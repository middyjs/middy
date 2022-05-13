import middy from '@middy/core'

interface Options {
  logger?: (message: any) => void
  awsContext?: boolean
  omitPaths?: string[]
  mask?: string
  replacer?: (this: any, key: string, value: any) => any | (number | string)[]
}

declare function inputOutputLogger (options?: Options): middy.MiddlewareObj

export default inputOutputLogger

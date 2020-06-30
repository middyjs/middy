import middy from '@middy/core'

declare const httpEventNormalizer : middy.Middleware<any, any, any>

export default httpEventNormalizer

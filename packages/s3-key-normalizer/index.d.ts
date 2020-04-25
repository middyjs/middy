import middy from '@middy/core'

declare const s3KeyNormalizer : middy.Middleware<any, any, any>

export default s3KeyNormalizer

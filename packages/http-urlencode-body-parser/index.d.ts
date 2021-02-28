import middy from '@middy/core'

declare const urlEncodeBodyParser: middy.Middleware<{}, any, any>

export default urlEncodeBodyParser

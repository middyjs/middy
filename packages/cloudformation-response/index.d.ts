import middy from '@middy/core'

interface Options {}

declare function cloudformationResponse(options?: Options): middy.MiddlewareObj

export default cloudformationResponse

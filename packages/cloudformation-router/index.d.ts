import middy from '@middy/core'
import { CloudFormationCustomResourceHandler } from 'aws-lambda'

interface Route<T = never> {
  requestType: string
  handler: CloudFormationCustomResourceHandler<T>
}

declare function cloudformationRouterHandler(
  routes: Route[]
): middy.MiddyfiedHandler

export default cloudformationRouterHandler

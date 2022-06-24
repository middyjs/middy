import SSM from 'aws-sdk/clients/ssm'
import { Options as MiddyOptions } from '@middy/util'
import middy from '@middy/core'

interface Options<S = SSM> extends MiddyOptions<S, SSM.Types.ClientConfiguration> {}

declare function ssm (options?: Options): middy.MiddlewareObj

export default ssm

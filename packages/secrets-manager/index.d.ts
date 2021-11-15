import { SecretsManager } from 'aws-sdk'
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'

interface Options<SM = SecretsManager> extends MiddyOptions<SM, SecretsManager.Types.ClientConfiguration> {}

declare function secretsManager (options?: Options): middy.MiddlewareObj

export default secretsManager

import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Signer } from '@aws-sdk/rds-signer'

interface Options<S = Signer> extends MiddyOptions<S, Signer.Types.ClientConfiguration> {}

declare function rdsSigner (options?: Options): middy.MiddlewareObj

export default rdsSigner

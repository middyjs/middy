import { Signer } from '@aws-sdk/rds-signer'
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'

interface Options<Signer = Signer> extends MiddyOptions<Signer, Signer.Types.ClientConfiguration> {}

declare function rdsSigner (options?: Options): middy.MiddlewareObj

export default rdsSigner

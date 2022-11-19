import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { SignerConfig, Signer } from '@aws-sdk/rds-signer'

interface Options<AwsSigner = Signer>
  extends MiddyOptions<AwsSigner, SignerConfig> {}

declare function rdsSigner (options?: Options): middy.MiddlewareObj

export default rdsSigner

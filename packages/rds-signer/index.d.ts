import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Signer } from '@aws-sdk/rds-signer'

interface Options<AwsSigner = Signer>
  extends MiddyOptions<AwsSigner, Signer.Types.ClientConfiguration> {}

declare function rdsSigner(options?: Options): middy.MiddlewareObj

export default rdsSigner

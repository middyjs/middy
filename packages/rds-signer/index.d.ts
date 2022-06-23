import RDS from 'aws-sdk/clients/rds'
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'

interface Options<Signer = RDS.Signer> extends MiddyOptions<Signer, RDS.Types.ClientConfiguration> {}

declare function rdsSigner (options?: Options): middy.MiddlewareObj

export default rdsSigner

import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { GetObjectCommandInput, S3Client, S3ClientConfig } from '@aws-sdk/client-s3'

export type Options<AwsS3Client = S3Client> = Omit<MiddyOptions<AwsS3Client, S3ClientConfig>, 'fetchData'>
& {
  fetchData?: {
    [key: string]: Omit<GetObjectCommandInput, 'ChecksumMode'> & {
      ChecksumMode?: never
    }
  }
}

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext & Record<keyof TOptions['fetchData'], any>
  : LambdaContext

declare function s3Middleware<TOptions extends Options | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default s3Middleware

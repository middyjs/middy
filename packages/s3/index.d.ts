/*
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3'

interface Options<AwsS3Client = S3Client>
  extends MiddyOptions<AwsS3Client, S3ClientConfig> {}

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext & Record<keyof TOptions['fetchData'], any>
  : LambdaContext

declare function s3<TOptions extends Options | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default s3
*/

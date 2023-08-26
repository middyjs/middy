import middy from '@middy/core'
import {SSMClient} from '@aws-sdk/client-ssm'
import {captureAWSv3Client} from 'aws-xray-sdk'
import {expectType} from 'tsd'
import ssm, {Context} from '.'
import {JsonValue} from "type-fest";
import {Context as LambdaContext} from "aws-lambda/handler";

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(ssm())

// use with all options
const options = {
  AwsClient: SSMClient,
  awsClientOptions: {
    credentials: {
      secretAccessKey: 'secret',
      sessionToken: 'token',
      accessKeyId: 'key'
    }
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSv3Client,
  disablePrefetch: true
}
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  ssm(options)
)

expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext, Record<"lorem" | "ipsum", JsonValue>>>(
  ssm({
    fetchData: {
      lorem: "/lorem",
      ipsum: "/lorem",
    }
  })
)

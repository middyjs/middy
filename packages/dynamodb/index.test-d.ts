import middy from '@middy/core'
import { Context as LambdaContext } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import dynamodb, { Context, dynamoDbReq } from '.'
import { getInternal } from '@middy/util'

const options = {
  AwsClient: DynamoDBClient,
  awsClientOptions: {
    credentials: {
      secretAccessKey: 'secret',
      sessionToken: 'token',
      accessKeyId: 'key'
    }
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSv3Client,
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToContext: false
} as const

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
  dynamodb()
)

// use with all options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  dynamodb(options)
)

// use with setToContext: true
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext & { configurationObjFromDynamo: Record<string, any> }, { configurationObjFromDynamo: Record<string, any> }>>(
  dynamodb({
    ...options,
    fetchData: {
      configurationObjFromDynamo: {
        TableName: 'someConfigTableName',
        Key: {
          pk: {
            S: 'someConfigItemPrimaryKey'
          }
        }
      }
    },
    setToContext: true
  })
)

// use with setToContext: false
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext, { configurationObjFromDynamo: Record<string, any> }>>(
  dynamodb({
    ...options,
    fetchData: {
      configurationObjFromDynamo: {
        TableName: 'someConfigTableName',
        Key: {
          pk: {
            S: 'someConfigItemPrimaryKey'
          }
        }
      }
    },
    setToContext: false
  })
)

// @ts-expect-error - fetchData must be an object
dynamodb({ ...options, fetchData: 'not an object' })

dynamodb({
  ...options,
  fetchData: {
    // @ts-expect-error - fetchData must be an object of objects
    key: 'null',
    // @ts-expect-error - fetchData must be an object of objects
    key2: null,
    // @ts-expect-error - fetchData must be an object of objects
    key3: undefined,
    // @ts-expect-error - fetchData must be an object of objects
    key4: 1,
    // @ts-expect-error - fetchData must be an object of objects
    key5: true,
    // @ts-expect-error - fetchData must be an object of objects
    key6: Symbol('key6')
  }
})

const handler = middy(async (event: {}, context: LambdaContext) => {
  return await Promise.resolve({})
})

handler.use(
  dynamodb({
    ...options,
    fetchData: {
      configurationObjFromDynamo: {
        TableName: 'someConfigTableName',
        Key: {
          pk: {
            S: 'someConfigItemPrimaryKey'
          }
        }
      }
    },
    setToContext: true
  })
)
  .before(async (request) => {
    expectType<Record<string, any>>(request.context.configurationObjFromDynamo)

    const data = await getInternal('configurationObjFromDynamo', request)
    expectType<Record<string, any>>(data.configurationObjFromDynamo)
  })

handler.use(
  dynamodb({
    ...options,
    fetchData: {
      configurationObjFromDynamo: {
        TableName: 'someConfigTableName',
        Key: {
          pk: {
            S: 'someConfigItemPrimaryKey'
          }
        }
      }
    },
    setToContext: false
  })
)
  .before(async (request) => {
    const data = await getInternal('configurationObjFromDynamo', request)
    expectType<Record<string, any>>(data.configurationObjFromDynamo)
  })

handler.use(
  dynamodb({
    ...options,
    fetchData: {
      configurationObjFromDynamo: dynamoDbReq<{ param1: string, param2: string, param3: number }>({
        TableName: 'someConfigTableName',
        Key: {
          pk: {
            S: 'someConfigItemPrimaryKey'
          }
        }
      })
    },
    setToContext: true
  })
)
  .before(async (request) => {
    expectType<{ param1: string, param2: string, param3: number }>(request.context.configurationObjFromDynamo)

    const data = await getInternal('configurationObjFromDynamo', request)
    expectType<{ param1: string, param2: string, param3: number }>(data.configurationObjFromDynamo)
  })

handler.use(
  dynamodb({
    ...options,
    fetchData: {
      configurationObjFromDynamo: dynamoDbReq<{ param1: string, param2: string, param3: number }>({
        TableName: 'someConfigTableName',
        Key: {
          pk: {
            S: 'someConfigItemPrimaryKey'
          }
        }
      })
    },
    setToContext: false
  })
)
  .before(async (request) => {
    const data = await getInternal('configurationObjFromDynamo', request)
    expectType<{ param1: string, param2: string, param3: number }>(data.configurationObjFromDynamo)
  })

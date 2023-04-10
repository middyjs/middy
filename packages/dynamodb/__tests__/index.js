import test from 'ava'
import sinon from 'sinon'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import dynamodb from '../index.js'

let sandbox
test.beforeEach((t) => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test.serial(
  'It should set DynamoDB param value to internal storage',
  async (t) => {
    mockClient(DynamoDBClient)
      .on(GetItemCommand)
      .resolvesOnce({
        Item: {
          value: {
            S: 'value'
          }
        }
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.value, 'value')
    }

    const handler = middy(() => {})
      .use(
        dynamodb({
          AwsClient: DynamoDBClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              TableName: 'table',
              Key: {
                pk: {
                  S: '0000'
                }
              }
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
  }
)

test.serial(
  'It should set DynamoDB param value to internal storage without prefetch',
  async (t) => {
    mockClient(DynamoDBClient)
      .on(GetItemCommand)
      .resolvesOnce({
        Item: {
          value: {
            S: 'value'
          }
        }
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.value, 'value')
    }

    const handler = middy(() => {})
      .use(
        dynamodb({
          AwsClient: DynamoDBClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              TableName: 'table',
              Key: {
                pk: {
                  S: '0000'
                }
              }
            }
          },
          disablePrefetch: true
        })
      )
      .before(middleware)

    await handler(event, context)
  }
)

test.serial('It should set DynamoDB param value to context', async (t) => {
  mockClient(DynamoDBClient)
    .on(GetItemCommand)
    .resolvesOnce({
      Item: {
        value: {
          S: 'value'
        }
      }
    })

  const middleware = async (request) => {
    t.is(request.context.key?.value, 'value')
  }

  const handler = middy(() => {})
    .use(
      dynamodb({
        AwsClient: DynamoDBClient,
        cacheExpiry: 0,
        fetchData: {
          key: {
            TableName: 'table',
            Key: {
              pk: {
                S: '0000'
              }
            }
          }
        },
        setToContext: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should not call aws-sdk again if parameter is cached forever',
  async (t) => {
    const mockService = mockClient(DynamoDBClient)
      .on(GetItemCommand)
      .resolvesOnce({
        Item: {
          value: {
            S: 'value'
          }
        }
      })
    const sendStub = mockService.send
    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.value, 'value')
    }

    const handler = middy(() => {})
      .use(
        dynamodb({
          AwsClient: DynamoDBClient,
          cacheExpiry: -1,
          fetchData: {
            key: {
              TableName: 'table',
              Key: {
                pk: {
                  S: '0000'
                }
              }
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(sendStub.callCount, 1)
  }
)

test.serial(
  'It should not call aws-sdk again if parameter is cached',
  async (t) => {
    const mockService = mockClient(DynamoDBClient)
      .on(GetItemCommand)
      .resolvesOnce({
        Item: {
          value: {
            S: 'value'
          }
        }
      })
    const sendStub = mockService.send

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.value, 'value')
    }

    const handler = middy(() => {})
      .use(
        dynamodb({
          AwsClient: DynamoDBClient,
          cacheExpiry: 1000,
          fetchData: {
            key: {
              TableName: 'table',
              Key: {
                pk: {
                  S: '0000'
                }
              }
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(sendStub.callCount, 1)
  }
)

test.serial(
  'It should call aws-sdk if cache enabled but cached param has expired',
  async (t) => {
    const mockService = mockClient(DynamoDBClient)
      .on(GetItemCommand)
      .resolves({
        Item: {
          value: {
            S: 'value'
          }
        }
      })
    const sendStub = mockService.send

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.value, 'value')
    }

    const handler = middy(() => {})
      .use(
        dynamodb({
          AwsClient: DynamoDBClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              TableName: 'table',
              Key: {
                pk: {
                  S: '0000'
                }
              }
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(sendStub.callCount, 2)
  }
)

test.serial('It should catch if an error is returned from fetch', async (t) => {
  const mockService = mockClient(DynamoDBClient)
    .on(GetItemCommand)
    .rejects('timeout')
  const sendStub = mockService.send

  const handler = middy(() => {}).use(
    dynamodb({
      AwsClient: DynamoDBClient,
      cacheExpiry: 0,
      fetchData: {
        key: {
          TableName: 'table',
          Key: {
            pk: {
              S: '0000'
            }
          }
        }
      },
      setToContext: true
    })
  )

  try {
    await handler(event, context)
  } catch (e) {
    t.is(sendStub.callCount, 1)
    t.is(e.message, 'Failed to resolve internal values')
    t.deepEqual(e.cause.data, [new Error('timeout')])
  }
})

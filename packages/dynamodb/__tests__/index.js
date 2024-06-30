import { test } from 'node:test'
import { equal, deepEqual } from 'node:assert/strict'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import dynamodb from '../index.js'

test.afterEach((t) => {
  t.mock.reset()
  clearCache()
})

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('It should set DynamoDB param value to internal storage', async (t) => {
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
    equal(values.key?.value, 'value')
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
})

test('It should set DynamoDB param value to internal storage without prefetch', async (t) => {
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
    equal(values.key?.value, 'value')
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
})

test('It should set DynamoDB param value to context', async (t) => {
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
    equal(request.context.key?.value, 'value')
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
        setToContext: true,
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test('It should not call aws-sdk again if parameter is cached forever', async (t) => {
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
    equal(values.key?.value, 'value')
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

  equal(sendStub.callCount, 1)
})

test('It should not call aws-sdk again if parameter is cached', async (t) => {
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
    equal(values.key?.value, 'value')
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

  equal(sendStub.callCount, 1)
})

test('It should call aws-sdk if cache enabled but cached param has expired', async (t) => {
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
    equal(values.key?.value, 'value')
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
  await handler(event, context)

  equal(sendStub.callCount, 2)
})

test('It should catch if an error is returned from fetch', async (t) => {
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
      setToContext: true,
      disablePrefetch: true
    })
  )

  try {
    await handler(event, context)
  } catch (e) {
    equal(sendStub.callCount, 1)
    equal(e.message, 'Failed to resolve internal values')
    deepEqual(e.cause.data, [new Error('timeout')])
  }
})

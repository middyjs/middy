import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import { Signer } from '@aws-sdk/rds-signer'
import rdsSigner from '../index.js'

let sandbox
test.beforeEach((t) => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

const mockService = (client, responseOne, responseTwo) => {
  const mock = sandbox.stub(client.prototype, 'getAuthToken')
  mock.onFirstCall().resolves(responseOne)
  if (responseTwo) mock.onSecondCall().resolves(responseTwo)

  return mock
}

const mockServiceError = (client, error) => {
  const mock = sandbox.stub(client.prototype, 'getAuthToken')
  mock.onFirstCall().rejects(error)

  return mock
}

const defaultEvent = {}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test.serial('It should set token to internal storage (token)', async (t) => {
  mockService(Signer, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    t.is(values.token, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
  }

  handler
    .use(
      rdsSigner({
        AwsClient: Signer,
        cacheExpiry: 0,
        fetchData: {
          token: {
            region: 'us-east-1',
            hostname: 'hostname',
            username: 'username',
            database: 'database',
            port: 5432
          }
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(defaultEvent, defaultContext)
})

test.serial('It should set tokens to internal storage (token)', async (t) => {
  mockService(
    Signer,
    'https://rds.amazonaws.com?X-Amz-Security-Token=token1',
    'https://rds.amazonaws.com?X-Amz-Security-Token=token2'
  )
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    t.is(values.token1, 'https://rds.amazonaws.com?X-Amz-Security-Token=token1')
    t.is(values.token2, 'https://rds.amazonaws.com?X-Amz-Security-Token=token2')
  }

  handler
    .use(
      rdsSigner({
        AwsClient: Signer,
        cacheExpiry: 0,
        fetchData: {
          token1: {
            region: 'us-east-1',
            hostname: 'hostname',
            username: 'username',
            database: 'database1',
            port: 5432
          },
          token2: {
            region: 'us-east-1',
            hostname: 'hostname',
            username: 'username',
            database: 'database2',
            port: 5432
          }
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(defaultEvent, defaultContext)
})

test.serial(
  'It should set Signer token to internal storage without prefetch',
  async (t) => {
    mockService(Signer, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
    }

    handler
      .use(
        rdsSigner({
          AwsClient: Signer,
          cacheExpiry: 0,
          fetchData: {
            token: {
              region: 'us-east-1',
              hostname: 'hostname',
              username: 'username',
              database: 'database',
              port: 5432
            }
          },
          disablePrefetch: true
        })
      )
      .before(middleware)

    await handler(defaultEvent, defaultContext)
  }
)

test.serial('It should set Signer token to context', async (t) => {
  mockService(Signer, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')

  const handler = middy(() => {})

  const middleware = async (request) => {
    t.is(
      request.context.token,
      'https://rds.amazonaws.com?X-Amz-Security-Token=token'
    )
  }

  handler
    .use(
      rdsSigner({
        AwsClient: Signer,
        cacheExpiry: 0,
        fetchData: {
          token: {
            region: 'us-east-1',
            hostname: 'hostname',
            username: 'username',
            database: 'database',
            port: 5432
          }
        },
        setToContext: true,
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(defaultEvent, defaultContext)
})

test.serial(
  'It should not call aws-sdk again if parameter is cached',
  async (t) => {
    const stub = mockService(
      Signer,
      'https://rds.amazonaws.com?X-Amz-Security-Token=token'
    )
    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
    }

    handler
      .use(
        rdsSigner({
          AwsClient: Signer,
          cacheExpiry: -1,
          fetchData: {
            token: {
              region: 'us-east-1',
              hostname: 'hostname',
              username: 'username',
              database: 'database',
              port: 5432
            }
          }
        })
      )
      .before(middleware)

    await handler(defaultEvent, defaultContext)
    await handler(defaultEvent, defaultContext)

    t.is(stub.callCount, 1)
  }
)

test.serial(
  'It should call aws-sdk if cache enabled but cached param has expired',
  async (t) => {
    const stub = mockService(
      Signer,
      'https://rds.amazonaws.com?X-Amz-Security-Token=token',
      'https://rds.amazonaws.com?X-Amz-Security-Token=token'
    )

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
    }

    handler
      .use(
        rdsSigner({
          AwsClient: Signer,
          cacheExpiry: 0,
          fetchData: {
            token: {
              region: 'us-east-1',
              hostname: 'hostname',
              username: 'username',
              database: 'database',
              port: 5432
            }
          },
          disablePrefetch: true
        })
      )
      .before(middleware)

    await handler(defaultEvent, defaultContext)
    await handler(defaultEvent, defaultContext)

    t.is(stub.callCount, 2)
  }
)

test.serial('It should catch if an error is returned from fetch', async (t) => {
  const stub = mockServiceError(Signer, new Error('timeout'))

  const handler = middy(() => {}).use(
    rdsSigner({
      AwsClient: Signer,
      cacheExpiry: 0,
      fetchData: {
        token: {
          region: 'us-east-1',
          hostname: 'hostname',
          username: 'username',
          database: 'database',
          port: 5432
        }
      },
      setToContext: true,
      disablePrefetch: true
    })
  )

  try {
    await handler(defaultEvent, defaultContext)
  } catch (e) {
    t.is(stub.callCount, 1)
    t.is(e.message, 'Failed to resolve internal values')
    t.deepEqual(e.cause, [new Error('timeout')])
  }
})

test.serial(
  'It should catch if an invalid response is returned from fetch',
  async (t) => {
    const stub = mockService(Signer, 'https://rds.amazonaws.com')

    const handler = middy(() => {}).use(
      rdsSigner({
        AwsClient: Signer,
        cacheExpiry: 0,
        fetchData: {
          token: {
            region: 'us-east-1',
            hostname: 'hostname',
            username: 'username',
            database: 'database',
            port: 5432
          }
        },
        setToContext: true,
        disablePrefetch: true
      })
    )

    try {
      const res = await handler(defaultEvent, defaultContext)
      console.log(res)
    } catch (e) {
      t.is(stub.callCount, 1)
      t.is(e.message, 'Failed to resolve internal values')
      t.deepEqual(e.cause, [
        new Error('[rds-signer] X-Amz-Security-Token Missing')
      ])
    }
  }
)

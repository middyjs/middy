const test = require('ava')
const sinon = require('sinon')
const middy = require('../../core/index.js')
const { getInternal, clearCache } = require('../../util')
const RDS = require('aws-sdk/clients/rds.js') // v2
// const {RDS} = require('@aws-sdk/client-rds') // v3
const rdsSigner = require('../index.js')

let sandbox
test.beforeEach((t) => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

const mockService = (client, responseOne, responseTwo) => {
  // aws-sdk v2
  const mock = sandbox.stub()
  // getAuthToken doesn't support .promise()
  // mock.onFirstCall().returns({ promise: () => Promise.resolve(responseOne) })
  // if (responseTwo) mock.onSecondCall().returns({ promise: () => Promise.resolve(responseTwo) })
  mock.onFirstCall().yields(null, responseOne)
  if (responseTwo) mock.onSecondCall().yields(null, responseTwo)
  client.prototype.getAuthToken = mock
  // aws-sdk v3
  // const mock = sandbox.stub(client.prototype, 'getAuthToken')
  // mock.onFirstCall().resolves(responseOne)
  // if (responseTwo) mock.onSecondCall().resolves(responseTwo)

  return mock
}

test.serial('It should set token to internal storage (token)', async (t) => {
  mockService(RDS.Signer, 'token')
  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token, 'token')
  }

  handler
    .use(
      rdsSigner({
        AwsClient: RDS.Signer,
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

  await handler()
})

test.serial('It should set tokens to internal storage (token)', async (t) => {
  mockService(RDS.Signer, 'token1', 'token2')

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token1, 'token1')
    t.is(values.token2, 'token2')
  }

  handler
    .use(
      rdsSigner({
        AwsClient: RDS.Signer,
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
        }
      })
    )
    .before(middleware)

  await handler()
})

test.serial(
  'It should set RDS.Signer token to internal storage without prefetch',
  async (t) => {
    mockService(RDS.Signer, 'token')

    const handler = middy((handler) => {})

    const middleware = async (handler) => {
      const values = await getInternal(true, handler)
      t.is(values.token, 'token')
    }

    handler
      .use(
        rdsSigner({
          AwsClient: RDS.Signer,
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

    await handler()
  }
)

test.serial('It should set RDS.Signer token to context', async (t) => {
  mockService(RDS.Signer, 'token')

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    t.is(handler.context.token, 'token')
  }

  handler
    .use(
      rdsSigner({
        AwsClient: RDS.Signer,
        fetchData: {
          token: {
            region: 'us-east-1',
            hostname: 'hostname',
            username: 'username',
            database: 'database',
            port: 5432
          }
        },
        setToContext: true
      })
    )
    .before(middleware)

  await handler()
})

test.serial('It should set RDS.Signer token to process.env', async (t) => {
  mockService(RDS.Signer, 'token')
  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    t.is(process.env.token, 'token')
  }

  handler
    .use(
      rdsSigner({
        AwsClient: RDS.Signer,
        fetchData: {
          token: {
            region: 'us-east-1',
            hostname: 'hostname',
            username: 'username',
            database: 'database',
            port: 5432
          }
        },
        setToEnv: true
      })
    )
    .before(middleware)

  await handler()
})

test.serial(
  'It should not call aws-sdk again if parameter is cached',
  async (t) => {
    const stub = mockService(RDS.Signer, 'token')
    const handler = middy((handler) => {})

    const middleware = async (handler) => {
      const values = await getInternal(true, handler)
      t.is(values.token, 'token')
    }

    handler
      .use(
        rdsSigner({
          AwsClient: RDS.Signer,
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

    await handler()
    await handler()

    t.is(stub.callCount, 1)
  }
)

test.serial(
  'It should call aws-sdk if cache enabled but cached param has expired',
  async (t) => {
    const stub = mockService(RDS.Signer, 'token', 'token')

    const handler = middy((handler) => {})

    const middleware = async (handler) => {
      const values = await getInternal(true, handler)
      t.is(values.token, 'token')
    }

    handler
      .use(
        rdsSigner({
          AwsClient: RDS.Signer,
          fetchData: {
            token: {
              region: 'us-east-1',
              hostname: 'hostname',
              username: 'username',
              database: 'database',
              port: 5432
            }
          },
          cacheExpiry: 0
        })
      )
      .before(middleware)

    await handler()
    await handler()

    t.is(stub.callCount, 2)
  }
)

const test = require('ava')
const sinon = require('sinon')
const middy = require('../../core/index.js')
const { getInternal, clearCache } = require('../../util')
const {Signer} = require('aws-sdk/clients/rds.js') // v2
// const {RDS:{Signer}} = require('@aws-sdk/client-rds') // v3
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
  mockService(Signer, 'https://rds.amazonaws.com?X-Amz-Security-Token=token1', 'https://rds.amazonaws.com?X-Amz-Security-Token=token2')

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

test.serial('It should set Signer token to context', async (t) => {
  mockService(Signer, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')

  const handler = middy(() => {})

  const middleware = async (request) => {
    t.is(request.context.token, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
  }

  handler
    .use(
      rdsSigner({
        AwsClient: Signer,
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

test.serial('It should set Signer token to process.env', async (t) => {
  mockService(Signer, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
  const handler = middy(() => {})

  const middleware = async () => {
    t.is(process.env.token, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
  }

  handler
    .use(
      rdsSigner({
        AwsClient: Signer,
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
    const stub = mockService(Signer, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
    }

    handler
      .use(
        rdsSigner({
          AwsClient: Signer,
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

// test.serial(
//   'It should catch missing X-Amz-Security-Token',
//   async (t) => {
//     const stub = mockService(Signer, 'https://rds.amazonaws.com')
//     const handler = middy(() => {})
//
//     handler
//       .use(
//         rdsSigner({
//           AwsClient: Signer,
//           fetchData: {
//             token: {
//               region: 'us-east-1',
//               hostname: 'hostname',
//               username: 'username',
//               database: 'database',
//               port: 5432
//             }
//           }
//         })
//       )
//
//     try {
//       await handler()
//     } catch(e) {
//       t.is( e.message, 'X-Amz-Security-Token Missing')
//     }
//     t.is(stub.callCount, 1)
//   }
// )

test.serial(
  'It should call aws-sdk if cache enabled but cached param has expired',
  async (t) => {
    const stub = mockService(Signer, 'https://rds.amazonaws.com?X-Amz-Security-Token=token', 'https://rds.amazonaws.com?X-Amz-Security-Token=token')

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
    }

    handler
      .use(
        rdsSigner({
          AwsClient: Signer,
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

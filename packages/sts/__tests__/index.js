const test = require('ava')
const sinon = require('sinon')
const middy = require('../../core/index.js')
const { getInternal, clearCache } = require('../../util/index.js')
const STS = require('aws-sdk/clients/sts.js') // v2
// const { STS } = require('@aws-sdk/client-sts') // v3
const sts = require('../index.js')

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
  mock.onFirstCall().returns({ promise: () => Promise.resolve(responseOne) })
  if (responseTwo) {
    mock.onSecondCall().returns({ promise: () => Promise.resolve(responseTwo) })
  }
  client.prototype.assumeRole = mock
  // aws-sdk v3
  // const mock = sandbox.stub(client.prototype, 'getSecretValue')
  // mock.onFirstCall().resolves(responseOne)
  // if (responseTwo) mock.onSecondCall().resolves(responseTwo)

  return mock
}

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test.serial('It should set credential to internal storage', async (t) => {
  mockService(STS, {
    Credentials: {
      AccessKeyId: 'accessKeyId',
      SecretAccessKey: 'secretAccessKey',
      SessionToken: 'sessionToken'
    }
  })

  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    t.deepEqual(values.role, {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken'
    })
  }

  handler
    .use(
      sts({
        AwsClient: STS,
        cacheExpiry: 0,
        fetchData: {
          role: {
            RoleArn: '.../role'
          }
        }
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should set STS secret to internal storage without prefetch',
  async (t) => {
    mockService(STS, {
      Credentials: {
        AccessKeyId: 'accessKeyId',
        SecretAccessKey: 'secretAccessKey',
        SessionToken: 'sessionToken'
      }
    })

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.deepEqual(values.role, {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken'
      })
    }

    handler
      .use(
        sts({
          AwsClient: STS,
          cacheExpiry: 0,
          fetchData: {
            role: {
              RoleArn: '.../role'
            }
          },
          disablePrefetch: true
        })
      )
      .before(middleware)

    await handler(event, context)
  }
)

test.serial('It should set STS secret to context', async (t) => {
  mockService(STS, {
    Credentials: {
      AccessKeyId: 'accessKeyId',
      SecretAccessKey: 'secretAccessKey',
      SessionToken: 'sessionToken'
    }
  })

  const handler = middy(() => {})

  const middleware = async (request) => {
    t.deepEqual(request.context.role, {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken'
    })
  }

  handler
    .use(
      sts({
        AwsClient: STS,
        cacheExpiry: 0,
        fetchData: {
          role: {
            RoleArn: '.../role'
          }
        },
        setToContext: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should not call aws-sdk again if parameter is cached',
  async (t) => {
    const stub = mockService(STS, {
      Credentials: {
        AccessKeyId: 'accessKeyId',
        SecretAccessKey: 'secretAccessKey',
        SessionToken: 'sessionToken'
      }
    })

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.deepEqual(values.role, {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken'
      })
    }

    handler
      .use(
        sts({
          AwsClient: STS,
          cacheExpiry: -1,
          fetchData: {
            role: {
              RoleArn: '.../role'
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(stub.callCount, 1)
  }
)

test.serial(
  'It should call aws-sdk if cache enabled but cached param has expired',
  async (t) => {
    const stub = mockService(
      STS,
      {
        Credentials: {
          AccessKeyId: 'accessKeyId',
          SecretAccessKey: 'secretAccessKey',
          SessionToken: 'sessionToken'
        }
      },
      {
        Credentials: {
          AccessKeyId: 'accessKeyId',
          SecretAccessKey: 'secretAccessKey',
          SessionToken: 'sessionToken'
        }
      }
    )

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.deepEqual(values.role, {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken'
      })
    }

    handler
      .use(
        sts({
          AwsClient: STS,
          cacheExpiry: 0,
          fetchData: {
            role: {
              RoleArn: '.../role'
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(stub.callCount, 2)
  }
)

import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import SecretsManager from 'aws-sdk/clients/secretsmanager.js' // v2
// import { SecretsManager } from '@aws-sdk/client-secrets-manager'  // v3
import secretsManager from '../index.js'

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
  client.prototype.getSecretValue = mock
  // aws-sdk v3
  // const mock = sandbox.stub(client.prototype, 'getSecretValue')
  // mock.onFirstCall().resolves(responseOne)
  // if (responseTwo) mock.onSecondCall().resolves(responseTwo)

  return mock
}

const mockServiceError = (client, error) => {
  // aws-sdk v2
  const mock = sandbox.stub()
  mock.onFirstCall().returns({ promise: () => Promise.reject(error) })
  client.prototype.getSecretValue = mock
  // aws-sdk v3
  // const mock = sandbox.stub(client.prototype, 'getSecretValue')
  // mock.onFirstCall().rejects(responseOne)
  // if (responseTwo) mock.onSecondCall().resolves(responseTwo)

  return mock
}

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test.serial('It should set secret to internal storage (token)', async (t) => {
  mockService(SecretsManager, {
    SecretString: 'token'
  })
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    t.is(values.token, 'token')
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManager,
        cacheExpiry: 0,
        fetchData: {
          token: 'api_key'
        }
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial('It should set secrets to internal storage (token)', async (t) => {
  mockService(
    SecretsManager,
    {
      SecretString: 'token1'
    },
    {
      SecretString: 'token2'
    }
  )

  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    t.is(values.token1, 'token1')
    t.is(values.token2, 'token2')
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManager,
        cacheExpiry: 0,
        fetchData: {
          token1: 'api_key1',
          token2: 'api_key2'
        }
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial('It should set secrets to internal storage (json)', async (t) => {
  const credentials = { username: 'admin', password: 'secret' }
  mockService(SecretsManager, {
    SecretString: JSON.stringify(credentials)
  })

  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(
      { username: 'credentials.username', password: 'credentials.password' },
      request
    )
    t.deepEqual(values, credentials)
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManager,
        cacheExpiry: 0,
        fetchData: {
          credentials: 'rds_login'
        }
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should set SecretsManager secret to internal storage without prefetch',
  async (t) => {
    mockService(SecretsManager, {
      SecretString: 'token'
    })

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'token')
    }

    handler
      .use(
        secretsManager({
          AwsClient: SecretsManager,
          cacheExpiry: 0,
          fetchData: {
            token: 'api_key'
          },
          disablePrefetch: true
        })
      )
      .before(middleware)

    await handler(event, context)
  }
)

test.serial('It should set SecretsManager secret to context', async (t) => {
  mockService(SecretsManager, {
    SecretString: 'token'
  })

  const handler = middy(() => {})

  const middleware = async (request) => {
    t.is(request.context.token, 'token')
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManager,
        cacheExpiry: 0,
        fetchData: {
          token: 'api_key'
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
    const stub = mockService(SecretsManager, {
      SecretString: 'token'
    })

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'token')
    }

    handler
      .use(
        secretsManager({
          AwsClient: SecretsManager,
          cacheExpiry: -1,
          fetchData: {
            token: 'api_key'
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
      SecretsManager,
      {
        SecretString: 'token'
      },
      {
        SecretString: 'token'
      }
    )

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'token')
    }

    handler
      .use(
        secretsManager({
          AwsClient: SecretsManager,
          cacheExpiry: 0,
          fetchData: {
            token: 'api_key'
          }
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(stub.callCount, 2)
  }
)

test.serial('It should catch if an error is returned from fetch', async (t) => {
  const stub = mockServiceError(SecretsManager, new Error('timeout'))

  const handler = middy(() => {}).use(
    secretsManager({
      AwsClient: SecretsManager,
      cacheExpiry: 0,
      fetchData: {
        token: 'api_key'
      },
      setToContext: true
    })
  )

  try {
    await handler(event, context)
  } catch (e) {
    t.is(stub.callCount, 1)
    t.is(e.message, 'Failed to resolve internal values')
    t.deepEqual(e.cause, [new Error('timeout')])
  }
})

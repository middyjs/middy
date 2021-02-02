const test = require('ava')
const sinon = require('sinon')
const middy = require('../../core/index.js')
const { getInternal, clearCache } = require('../../util')
const SecretsManager = require('aws-sdk/clients/secretsmanager.js')  // v2
//const { SecretsManager } = require('@aws-sdk/client-secrets-manager')  // v3
const secretsManager = require('../index.js')

let sandbox
test.beforeEach(t => {
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
  if (responseTwo) mock.onSecondCall().returns({ promise: () => Promise.resolve(responseTwo) })
  client.prototype.getSecretValue = mock
  // aws-sdk v3
  // const mock = sandbox.stub(client.prototype, 'getSecretValue')
  // mock.onFirstCall().resolves(responseOne)
  // if (responseTwo) mock.onSecondCall().resolves(responseTwo)

  return mock
}

test.serial('It should set secret to internal storage (token)', async (t) => {
  mockService(SecretsManager, {
    SecretString: 'token'
  })
  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token, 'token')
  }

  handler
    .use(secretsManager({
      AwsClient: SecretsManager,
      fetchData: {
        token: 'api_key'
      }
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set secrets to internal storage (token)', async (t) => {
  mockService(SecretsManager,{
    SecretString: 'token1'
  }, {
    SecretString: 'token2'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token1, 'token1')
    t.is(values.token2, 'token2')
  }

  handler
    .use(secretsManager({
      AwsClient: SecretsManager,
      fetchData: {
        token1: 'api_key1',
        token2: 'api_key2'
      }
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set secrets to internal storage (json)', async (t) => {
  const credentials = { username: 'admin', password: 'secret' }
  mockService(SecretsManager,{
    SecretString: JSON.stringify(credentials)
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal({ username: 'credentials.username', password: 'credentials.password' }, handler)
    t.deepEqual(values, credentials)
  }

  handler
    .use(secretsManager({
      AwsClient: SecretsManager,
      fetchData: {
        credentials: 'rds_login'
      }
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set SecretsManager secret to internal storage without prefetch', async (t) => {
  mockService(SecretsManager,{
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token, 'token')
  }

  handler
    .use(secretsManager({
      AwsClient: SecretsManager,
      fetchData: {
        token: 'api_key'
      },
      disablePrefetch: true
    }))
    .before(middleware)

  await handler()

})

test.serial('It should set SecretsManager secret to context', async (t) => {
  mockService(SecretsManager,{
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    t.is(handler.context.token, 'token')
  }

  handler
    .use(secretsManager({
      AwsClient: SecretsManager,
      fetchData: {
        token: 'api_key'
      },
      setToContext: true
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set SecretsManager secret to process.env', async (t) => {
  mockService(SecretsManager,{
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    t.is(process.env.token, 'token')
  }

  handler
    .use(secretsManager({
      AwsClient: SecretsManager,
      fetchData: {
        token: 'api_key'
      },
      setToEnv: true
    }))
    .before(middleware)

  await handler()
})

test.serial('It should not call aws-sdk again if parameter is cached', async (t) => {
  const stub = mockService(SecretsManager,{
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token, 'token')
  }

  const onChange = sinon.spy()
  handler
    .use(secretsManager({
      AwsClient: SecretsManager,
      fetchData: {
        token: 'api_key'
      },
      onChange
    }))
    .before(middleware)

  await handler()
  await handler()

  t.is(onChange.callCount, 1)
  t.is(stub.callCount, 1)
})

test.serial('It should call aws-sdk if cache enabled but cached param has expired', async (t) => {
  const stub = mockService(SecretsManager,{
    SecretString: 'token'
  },{
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token, 'token')
  }

  handler
    .use(secretsManager({
      AwsClient: SecretsManager,
      fetchData: {
        token: 'api_key'
      },
      cacheExpiry: 0
    }))
    .before(middleware)

  await handler()
  await handler()

  t.is(stub.callCount, 2)
})

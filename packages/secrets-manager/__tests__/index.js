import test from 'ava'
import sinon from 'sinon'
import { SecretsManager } from '@aws-sdk/client-secrets-manager'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../core/util.js'
import secretsManager from '../index.js'

let sandbox
test.beforeEach(t => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

test.serial('It should set secret to internal storage (token)', async (t) => {
  sandbox.stub(SecretsManager.prototype, 'getSecretValue').resolves({
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token, 'token')
  }

  handler
    .use(secretsManager({
      awsClientConstructor: SecretsManager,
      fetchData: {
        token: 'api_key'
      }
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set secrets to internal storage (token)', async (t) => {
  sandbox.stub(SecretsManager.prototype, 'getSecretValue')
    .onFirstCall().resolves({
      SecretString: 'token1'
    })
    .onSecondCall().resolves({
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
      awsClientConstructor: SecretsManager,
      fetchData: {
        token1: 'api_key1',
        token2: 'api_key2'
      }
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set secrets to internal storage (json)', async (t) => {
  const credentials = {username:'admin',password:'secret'}
  sandbox.stub(SecretsManager.prototype, 'getSecretValue').resolves({
    SecretString: JSON.stringify(credentials)
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal({username:'credentials.username', password:'credentials.password'}, handler)
    t.deepEqual(values, credentials)
  }

  handler
    .use(secretsManager({
      awsClientConstructor: SecretsManager,
      fetchData: {
        credentials: 'rds_login'
      }
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set SecretsManager secret to internal storage without prefetch', async (t) => {
  sandbox.stub(SecretsManager.prototype, 'getSecretValue').resolves({
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token, 'token')
  }

  handler
    .use(secretsManager({
      awsClientConstructor: SecretsManager,
      fetchData: {
        token: 'api_key'
      },
      disablePrefetch: true
    }))
    .before(middleware)

  await handler()

})

test.serial('It should set SecretsManager secret to context', async (t) => {
  sandbox.stub(SecretsManager.prototype, 'getSecretValue').resolves({
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    t.is(handler.context.token, 'token')
  }

  handler
    .use(secretsManager({
      awsClientConstructor: SecretsManager,
      fetchData: {
        token: 'api_key'
      },
      setContext: true
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set SecretsManager secret to process.env', async (t) => {
  sandbox.stub(SecretsManager.prototype, 'getSecretValue').resolves({
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    t.is(process.env.token, 'token')
  }

  handler
    .use(secretsManager({
      awsClientConstructor: SecretsManager,
      fetchData: {
        token: 'api_key'
      },
      setProcessEnv: true
    }))
    .before(middleware)

  await handler()
})

test.serial('It should not call aws-sdk again if parameter is cached', async (t) => {
  const stub = sandbox.stub(SecretsManager.prototype, 'getSecretValue').resolves({
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token, 'token')
  }

  handler
    .use(secretsManager({
      awsClientConstructor: SecretsManager,
      fetchData: {
        token: 'api_key'
      }
    }))
    .before(middleware)

  await handler()
  await handler()

  t.is(stub.callCount, 1)
})

test.serial('It should call aws-sdk if cache enabled but cached param has expired', async (t) => {
  const stub = sandbox.stub(SecretsManager.prototype, 'getSecretValue').resolves({
    SecretString: 'token'
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.token, 'token')
  }

  handler
    .use(secretsManager({
      awsClientConstructor: SecretsManager,
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

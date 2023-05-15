import test from 'ava'
import sinon from 'sinon'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager'
import secretsManager from '../index.js'

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

test.serial('It should set secret to internal storage (token)', async (t) => {
  mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolvesOnce({ SecretString: 'token' })
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    t.is(values.token, 'token')
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManagerClient,
        cacheExpiry: 0,
        fetchData: {
          token: 'api_key'
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial('It should set secrets to internal storage (token)', async (t) => {
  mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key1' })
    .resolvesOnce({ SecretString: 'token1' })
    .on(GetSecretValueCommand, { SecretId: 'api_key2' })
    .resolvesOnce({ SecretString: 'token2' })

  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    t.is(values.token1, 'token1')
    t.is(values.token2, 'token2')
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManagerClient,
        cacheExpiry: 0,
        fetchData: {
          token1: 'api_key1',
          token2: 'api_key2'
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial('It should set secrets to internal storage (json)', async (t) => {
  const credentials = { username: 'admin', password: 'secret' }
  mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'rds_login' })
    .resolvesOnce({ SecretString: JSON.stringify(credentials) })

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
        AwsClient: SecretsManagerClient,
        cacheExpiry: 0,
        fetchData: {
          credentials: 'rds_login'
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should set SecretsManager secret to internal storage without prefetch',
  async (t) => {
    mockClient(SecretsManagerClient)
      .on(GetSecretValueCommand, { SecretId: 'api_key' })
      .resolvesOnce({ SecretString: 'token' })

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'token')
    }

    handler
      .use(
        secretsManager({
          AwsClient: SecretsManagerClient,
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
  mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolvesOnce({ SecretString: 'token' })

  const handler = middy(() => {})

  const middleware = async (request) => {
    t.is(request.context.token, 'token')
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManagerClient,
        cacheExpiry: 0,
        fetchData: {
          token: 'api_key'
        },
        setToContext: true,
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should not call aws-sdk again if parameter is cached',
  async (t) => {
    const mockService = mockClient(SecretsManagerClient)
      .on(GetSecretValueCommand, { SecretId: 'api_key' })
      .resolvesOnce({ SecretString: 'token' })
    const sendStub = mockService.send

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'token')
    }

    handler
      .use(
        secretsManager({
          AwsClient: SecretsManagerClient,
          cacheExpiry: -1,
          fetchData: {
            token: 'api_key'
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
    const mockService = mockClient(SecretsManagerClient)
      .on(GetSecretValueCommand, { SecretId: 'api_key' })
      .resolves({ SecretString: 'token' })
    const sendStub = mockService.send
    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.token, 'token')
    }

    handler
      .use(
        secretsManager({
          AwsClient: SecretsManagerClient,
          cacheExpiry: 0,
          fetchData: {
            token: 'api_key'
          },
          disablePrefetch: true
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(sendStub.callCount, 2)
  }
)

test.serial('It should catch if an error is returned from fetch', async (t) => {
  const mockService = mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .rejects('timeout')
  const sendStub = mockService.send

  const handler = middy(() => {}).use(
    secretsManager({
      AwsClient: SecretsManagerClient,
      cacheExpiry: 0,
      fetchData: {
        token: 'api_key'
      },
      setToContext: true,
      disablePrefetch: true
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

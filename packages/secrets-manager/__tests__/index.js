import { setTimeout } from 'node:timers/promises'
import { test } from 'node:test'
import { equal, deepEqual } from 'node:assert/strict'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import {
  SecretsManagerClient,
  DescribeSecretCommand,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager'
import secretsManager from '../index.js'

test.afterEach((t) => {
  t.mock.reset()
  clearCache()
})

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('It should set secret to internal storage (token)', async (t) => {
  mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolvesOnce({ SecretString: 'token' })
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
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

test('It should set secrets to internal storage (token)', async (t) => {
  mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key1' })
    .resolvesOnce({ SecretString: 'token1' })
    .on(GetSecretValueCommand, { SecretId: 'api_key2' })
    .resolvesOnce({ SecretString: 'token2' })

  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token1, 'token1')
    equal(values.token2, 'token2')
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

test('It should set secrets to internal storage (json)', async (t) => {
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
    deepEqual(values, credentials)
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

test('It should set SecretsManager secret to internal storage without prefetch', async (t) => {
  mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolvesOnce({ SecretString: 'token' })

  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
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

test('It should set SecretsManager secret to context', async (t) => {
  mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolvesOnce({ SecretString: 'token' })

  const handler = middy(() => {})

  const middleware = async (request) => {
    equal(request.context.token, 'token')
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

test('It should not call aws-sdk again if parameter is cached', async (t) => {
  const mockService = mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolvesOnce({ SecretString: 'token' })
  const sendStub = mockService.send

  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
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

  equal(sendStub.callCount, 1)
})

test('It should call aws-sdk if cache enabled but cached param has expired', async (t) => {
  const mockService = mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolves({ SecretString: 'token' })
  const sendStub = mockService.send
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
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

  equal(sendStub.callCount, 2)
})

test('It should call aws-sdk if cache enabled but cached param has expired using LastRotationDate', async (t) => {
  const mockService = mockClient(SecretsManagerClient)
    .on(DescribeSecretCommand, { SecretId: 'api_key' })
    .resolves({
      LastRotationDate: Date.now() / 1000 - 50,
      LastChangedDate: Date.now() / 1000 - 50
    })
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolves({ SecretString: 'token' })
  const sendStub = mockService.send
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManagerClient,
        cacheExpiry: 100,
        fetchData: {
          token: 'api_key'
        },
        fetchRotationDate: true,
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context) // fetch x 2
  await handler(event, context)
  await setTimeout(100)
  await handler(event, context) // fetch x 2

  equal(sendStub.callCount, 2 * 2)
})

test('It should call aws-sdk if cache enabled but cached param has expired using LastRotationDate, fallback to NextRotationDate', async (t) => {
  const now = Date.now() / 1000
  const mockService = mockClient(SecretsManagerClient)
    .on(DescribeSecretCommand, { SecretId: 'api_key' })
    .resolves({
      LastRotationDate: now - 25,
      LastChangedDate: now - 25,
      NextRotationDate: now + 50
    })
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolves({ SecretString: 'token' })
  const sendStub = mockService.send
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManagerClient,
        cacheExpiry: 100,
        fetchData: {
          token: 'api_key'
        },
        fetchRotationDate: true,
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
  await handler(event, context)
  await setTimeout(100)
  await handler(event, context)

  equal(sendStub.callCount, 4)
})

test('It should call aws-sdk if cache enabled but cached param has expired using NextRotationDate', async (t) => {
  const mockService = mockClient(SecretsManagerClient)
    .on(DescribeSecretCommand, { SecretId: 'api_key' })
    .resolves({ NextRotationDate: Date.now() / 1000 + 50 })
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .resolves({ SecretString: 'token' })
  const sendStub = mockService.send
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
  }

  handler
    .use(
      secretsManager({
        AwsClient: SecretsManagerClient,
        cacheExpiry: -1,
        fetchData: {
          token: 'api_key'
        },
        fetchRotationDate: true,
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
  await handler(event, context)
  await setTimeout(100)
  await handler(event, context)

  equal(sendStub.callCount, 2)
})

test('It should catch if an error is returned from fetch', async (t) => {
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
    equal(sendStub.callCount, 1)
    equal(e.message, 'Failed to resolve internal values')
    deepEqual(e.cause.data, [new Error('timeout')])
  }
})

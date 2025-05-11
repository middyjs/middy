import { test } from 'node:test'
import { equal, deepEqual } from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import parametersSecretsLambdaExtension from '../index.js'

const mockFetchCache = {}
const mockFetch = (url, response) => {
  mockFetchCache[url] = JSON.stringify(response)
}
global.fetch = (url) => {
  // console.log('fetch(', url, ')', mockFetchCache[url])
  fetchCount += 1
  return Promise.resolve(
    new Response(mockFetchCache[url], {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json; charset=UTF-8'
      })
    })
  )
}

mockFetch(
  'http://localhost:2773/systemsmanager/parameters/get/?name=/dev/service_name/key_name',
  {
    Parameter: {
      Value: 'key-value'
    }
  }
)
// mockFetch(
//   'http://localhost:2773/systemsmanager/parameters/get/?name=/dev/service_name/invalid-ssm-param-name',
//   {
//     InvalidParameter: {
//       Name: 'invalid-ssm-param-name'
//     }
//   }
// )

mockFetch('http://localhost:2773/secretsmanager/get?secretId=api_key', {
  SecretString: 'token'
})
mockFetch('http://localhost:2773/secretsmanager/get?secretId=api_key1', {
  SecretString: 'token1'
})
mockFetch('http://localhost:2773/secretsmanager/get?secretId=api_key2', {
  SecretString: 'token2'
})
mockFetch('http://localhost:2773/secretsmanager/get?secretId=rds_login', {
  SecretString: JSON.stringify({ username: 'admin', password: 'secret' })
})

test.beforeEach((t) => {
  fetchCount = 0
  event = {}
  context = {
    getRemainingTimeInMillis: () => 1000
  }
})

test.afterEach((t) => {
  t.mock.reset()
  clearCache()
})

let fetchCount = 0
let event = {}
let context = {}

// systemsmanger
test('It should set SSM param value to internal storage', async (t) => {
  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.key, 'key-value')
  }

  const handler = middy(() => {})
    .use(
      parametersSecretsLambdaExtension({
        type: 'systemsmanager',
        cacheExpiry: 0,
        fetchData: {
          key: '/dev/service_name/key_name'
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test('It should set SSM param value to internal storage without prefetch', async (t) => {
  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.key, 'key-value')
  }

  const handler = middy(() => {})
    .use(
      parametersSecretsLambdaExtension({
        type: 'systemsmanager',
        cacheExpiry: 0,
        fetchData: {
          key: '/dev/service_name/key_name'
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test('It should set SSM param value to context', async (t) => {
  const middleware = async (request) => {
    equal(request.context.key, 'key-value')
  }

  const handler = middy(() => {})
    .use(
      parametersSecretsLambdaExtension({
        type: 'systemsmanager',
        cacheExpiry: 0,
        fetchData: {
          key: '/dev/service_name/key_name'
        },
        setToContext: true,
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test('It should not call localhost again if parameter is cached forever', async (t) => {
  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.key, 'key-value')
  }

  const handler = middy(() => {})
    .use(
      parametersSecretsLambdaExtension({
        type: 'systemsmanager',
        cacheExpiry: -1,
        fetchData: {
          key: '/dev/service_name/key_name'
        }
      })
    )
    .before(middleware)

  await handler(event, context)
  await handler(event, context)

  equal(fetchCount, 1)
})

test('It should not call aws-sdk again if parameter is cached', async (t) => {
  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.key, 'key-value')
  }

  const handler = middy(() => {})
    .use(
      parametersSecretsLambdaExtension({
        type: 'systemsmanager',
        cacheExpiry: 1000,
        fetchData: {
          key: '/dev/service_name/key_name'
        }
      })
    )
    .before(middleware)

  await handler(event, context)
  await handler(event, context)

  equal(fetchCount, 1)
})

test('It should call aws-sdk everytime if cache disabled', async (t) => {
  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.key, 'key-value')
  }

  const handler = middy(() => {})
    .use(
      parametersSecretsLambdaExtension({
        type: 'systemsmanager',
        cacheExpiry: 0,
        fetchData: {
          key: '/dev/service_name/key_name'
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
  await handler(event, context)

  equal(fetchCount, 2)
})

test('It should call aws-sdk if cache enabled but cached param has expired', async (t) => {
  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.key, 'key-value')
  }

  const handler = middy(() => {})
    .use(
      parametersSecretsLambdaExtension({
        type: 'systemsmanager',
        cacheExpiry: 4,
        fetchData: {
          key: '/dev/service_name/key_name'
        },
        disablePrefetch: true
      })
    )
    .before(middleware)
  await handler(event, context)
  await setTimeout(5)
  await handler(event, context)
  equal(fetchCount, 2)
})

/* test('It should it should recover from an error if cache enabled but cached param has expired', async (t) => {
  const awsError = new Error(
    'InvalidSignatureException: Signature expired: 20231103T171116Z is now earlier than 20231103T171224Z (20231103T171724Z - 5 min.)'
  )
  awsError.__type = 'InvalidSignatureException'
  const mockService = mockClient(SSMClient)
    .on(GetParametersCommand, {
      Names: ['/dev/service_name/key_name'],
      WithDecryption: true
    })
    .resolvesOnce({
      Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
    })
    .rejectsOnce(awsError)
    .resolves({
      Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
    })
  const sendStub = mockService.send

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.key, 'key-value')
  }

  const handler = middy(() => {})
    .use(
      parametersSecretsLambdaExtension({
        type: 'systemsmanager',
        cacheExpiry: 4,
        fetchData: {
          key: '/dev/service_name/key_name'
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
  await setTimeout(5)
  await handler(event, context)
  await setTimeout(5)
  await handler(event, context)

  equal(fetchCount, 4)
}) */

/* test('It should throw error if InvalidParameters returned', async (t) => {
  const handler = middy(() => {}).use(
    parametersSecretsLambdaExtension({
      type: 'systemsmanager',
      cacheExpiry: 0,
      fetchData: {
        a: 'invalid-ssm-param-name',
        key: '/dev/service_name/key_name'
      },
      disablePrefetch: true,
      setToContext: true
    })
  )

  try {
    await handler(event, context)
    ok(false)
  } catch (e) {
    equal(e.message, 'Failed to resolve internal values')
    deepEqual(e.cause.data, [
      new Error('InvalidParameter invalid-ssm-param-name', {
        cause: { package: '@middy/parameters-secrets-extension' }
      })
    ])
  }
}) */

/* test('It should catch if an error is returned from fetchRequest', async (t) => {
  const mockService = mockClient(SSMClient)
    .on(GetParametersCommand)
    .rejects('timeout')
  const sendStub = mockService.send

  const handler = middy(() => {}).use(
    parametersSecretsLambdaExtension({
      type: 'systemsmanager',
      cacheExpiry: 0,
      fetchData: {
        key: '/dev/service_name/key_name'
      },
      setToContext: true,
      disablePrefetch: true
    })
  )

  try {
    await handler(event, context)
  } catch (e) {
    equal(fetchCount, 1)
    equal(e.message, 'Failed to resolve internal values')
    deepEqual(e.cause.data, [new Error('timeout')])
  }
}) */

// secretsmanager

test('It should set secret to internal storage (token)', async (t) => {
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
  }

  handler
    .use(
      parametersSecretsLambdaExtension({
        type: 'secretsmanager',
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
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token1, 'token1')
    equal(values.token2, 'token2')
  }

  handler
    .use(
      parametersSecretsLambdaExtension({
        type: 'secretsmanager',
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
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(
      { username: 'credentials.username', password: 'credentials.password' },
      request
    )
    deepEqual(values, { username: 'admin', password: 'secret' })
  }

  handler
    .use(
      parametersSecretsLambdaExtension({
        type: 'secretsmanager',
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
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
  }

  handler
    .use(
      parametersSecretsLambdaExtension({
        type: 'secretsmanager',
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
  const handler = middy(() => {})

  const middleware = async (request) => {
    equal(request.context.token, 'token')
  }

  handler
    .use(
      parametersSecretsLambdaExtension({
        type: 'secretsmanager',
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
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
  }

  handler
    .use(
      parametersSecretsLambdaExtension({
        type: 'secretsmanager',
        cacheExpiry: -1,
        fetchData: {
          token: 'api_key'
        }
      })
    )
    .before(middleware)

  await handler(event, context)
  await handler(event, context)

  equal(fetchCount, 1)
})

test('It should call aws-sdk if cache enabled but cached param has expired', async (t) => {
  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    equal(values.token, 'token')
  }

  handler
    .use(
      parametersSecretsLambdaExtension({
        type: 'secretsmanager',
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

  equal(fetchCount, 2)
})

/* test('It should catch if an error is returned from fetch', async (t) => {
  const mockService = mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand, { SecretId: 'api_key' })
    .rejects('timeout')
  const sendStub = mockService.send

  const handler = middy(() => {}).use(
    parametersSecretsLambdaExtension({
      type: 'secretsmanager',
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
    equal(fetchCount, 1)
    equal(e.message, 'Failed to resolve internal values')
    deepEqual(e.cause.data, [new Error('timeout')])
  }
})
*/

import test from 'ava'
import sinon from 'sinon'
import { setTimeout } from 'node:timers/promises'
import {
  createClient,
  canPrefetch,
  getInternal,
  getCache,
  processCache,
  modifyCache,
  clearCache,
  jsonSafeParse,
  jsonSafeStringify,
  sanitizeKey,
  normalizeHttpResponse,
  HttpError,
  createError
} from '../index.js'

process.env.AWS_REGION = 'ca-central-1'

console.warn = () => {}

// createClient
test('createClient should create AWS Client', async (t) => {
  const AwsClient = sinon.spy()

  await createClient({
    AwsClient
  })
  t.is(AwsClient.callCount, 1)
  t.deepEqual(Object.keys(AwsClient.args[0][0]), ['requestHandler'])
})

test('createClient should create AWS Client with options', async (t) => {
  const AwsClient = sinon.spy()

  await createClient({
    AwsClient,
    awsClientOptions: { apiVersion: '2014-11-06' }
  })
  t.is(AwsClient.callCount, 1)
  t.deepEqual(Object.keys(AwsClient.args[0][0]), [
    'requestHandler',
    'apiVersion'
  ])
  t.is(AwsClient.args[0][0].apiVersion, '2014-11-06')
})

test('createClient should throw when creating AWS Client with role and no request', async (t) => {
  const AwsClient = sinon.spy()

  try {
    await createClient({
      AwsClient,
      awsClientAssumeRole: 'adminRole'
    })
  } catch (e) {
    t.is(e.message, 'Request required when assuming role')
  }
})

test('createClient should create AWS Client with role', async (t) => {
  const AwsClient = sinon.spy()

  const request = {
    internal: {
      adminRole: 'creds object'
    }
  }
  await createClient(
    {
      AwsClient,
      awsClientAssumeRole: 'adminRole'
    },
    request
  )
  t.is(AwsClient.callCount, 1)
  t.deepEqual(Object.keys(AwsClient.args[0][0]), [
    'requestHandler',
    'credentials'
  ])
  t.is(AwsClient.args[0][0].credentials, 'creds object')
})

test('createClient should create AWS Client with role from promise', async (t) => {
  const AwsClient = sinon.spy()

  const request = {
    internal: {
      adminRole: Promise.resolve('creds object')
    }
  }
  await createClient(
    {
      AwsClient,
      awsClientAssumeRole: 'adminRole'
    },
    request
  )
  t.is(AwsClient.callCount, 1)
  t.deepEqual(Object.keys(AwsClient.args[0][0]), [
    'requestHandler',
    'credentials'
  ])
  t.is(AwsClient.args[0][0].credentials, 'creds object')
})

test('createClient should create AWS Client with capture', async (t) => {
  const AwsClient = sinon.spy()
  const awsClientCapture = sinon.spy()

  await createClient({
    AwsClient,
    awsClientCapture,
    disablePrefetch: true
  })
  t.is(AwsClient.callCount, 1)
  t.is(awsClientCapture.callCount, 1)
  t.deepEqual(Object.keys(AwsClient.args[0][0]), ['requestHandler'])
})

test('createClient should create AWS Client without capture', async (t) => {
  const AwsClient = sinon.spy()
  const awsClientCapture = sinon.spy()

  await createClient({
    AwsClient,
    awsClientCapture
  })
  t.is(AwsClient.callCount, 1)
  t.is(awsClientCapture.callCount, 0)
  t.deepEqual(Object.keys(AwsClient.args[0][0]), ['requestHandler'])
})

// canPrefetch
test('canPrefetch should prefetch', async (t) => {
  const prefetch = canPrefetch()
  t.is(prefetch, true)
})

test('canPrefetch should not prefetch with assume role set', async (t) => {
  const prefetch = canPrefetch({
    awsClientAssumeRole: 'admin'
  })
  t.is(prefetch, false)
})

test('canPrefetch should not prefetch when disabled', async (t) => {
  const prefetch = canPrefetch({
    disablePrefetch: true
  })
  t.is(prefetch, false)
})

// getInternal
const getInternalRequest = {
  internal: {
    boolean: true,
    number: 1,
    string: 'string',
    array: [],
    object: {
      key: 'value'
    },
    promise: Promise.resolve('promise'),
    promiseObject: Promise.resolve({
      key: 'value'
    })
    // promiseReject: Promise.reject('promise')
  }
}
test('getInternal should get none from internal store', async (t) => {
  const values = await getInternal(false, getInternalRequest)
  t.deepEqual(values, {})
})

test('getInternal should get all from internal store', async (t) => {
  const values = await getInternal(true, getInternalRequest)
  t.deepEqual(values, {
    array: [],
    boolean: true,
    number: 1,
    object: {
      key: 'value'
    },
    promise: 'promise',
    promiseObject: {
      key: 'value'
    },
    string: 'string'
  })
})

test('getInternal should get from internal store when string', async (t) => {
  const values = await getInternal('number', getInternalRequest)
  t.deepEqual(values, { number: 1 })
})

test('getInternal should get from internal store when array[string]', async (t) => {
  const values = await getInternal(['boolean', 'string'], getInternalRequest)
  t.deepEqual(values, { boolean: true, string: 'string' })
})

test('getInternal should get from internal store when object', async (t) => {
  const values = await getInternal({ newKey: 'promise' }, getInternalRequest)
  t.deepEqual(values, { newKey: 'promise' })
})

test('getInternal should get from internal store a nested value', async (t) => {
  const values = await getInternal('promiseObject.key', getInternalRequest)
  t.deepEqual(values, { promiseObject_key: 'value' })
})

// sanitizeKey
test('sanitizeKey should sanitize key', async (t) => {
  const key = sanitizeKey('api//secret-key0.pem')
  t.is(key, 'api_secret_key0_pem')
})

test('sanitizeKey should sanitize key with leading number', async (t) => {
  const key = sanitizeKey('0key')
  t.is(key, '_0key')
})

test('sanitizeKey should not sanitize key', async (t) => {
  const key = sanitizeKey('api_secret_key0_pem')
  t.is(key, 'api_secret_key0_pem')
})

// processCache / clearCache
const cacheRequest = {
  internal: {}
}
test.serial('processCache should not cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  const options = {
    cacheKey: 'key',
    cacheExpiry: 0
  }
  processCache(options, fetch, cacheRequest)
  const cache = getCache('key')
  t.deepEqual(cache, {})
  clearCache()
})

test.serial('processCache should cache forever', async (t) => {
  const fetch = sinon.stub().resolves('value')
  const options = {
    cacheKey: 'key',
    cacheExpiry: -1
  }
  processCache(options, fetch, cacheRequest)
  await setTimeout(100)
  const cacheValue = getCache('key').value
  t.is(await cacheValue, 'value')
  const { value, cache } = processCache(options, fetch, cacheRequest)
  t.is(await value, 'value')
  t.true(cache)
  t.is(fetch.callCount, 1)
  clearCache()
})

test.serial('processCache should cache when not expired', async (t) => {
  const fetch = sinon.stub().resolves('value')
  const options = {
    cacheKey: 'key',
    cacheExpiry: 100
  }
  processCache(options, fetch, cacheRequest)
  await setTimeout(50)
  const cacheValue = getCache('key').value
  t.is(await cacheValue, 'value')
  const { value, cache } = processCache(options, fetch, cacheRequest)
  t.is(await value, 'value')
  t.is(cache, true)
  t.is(fetch.callCount, 1)
  clearCache()
})

test.serial(
  'processCache should clear and re-fetch modified cache',
  async (t) => {
    const options = {
      cacheKey: 'key',
      cacheExpiry: -1
    }
    const fetch = sinon.stub().returns({
      a: 'value',
      b: new Promise(() => {
        throw new Error('error')
      }).catch((e) => {
        const value = getCache(options.cacheKey).value || { value: {} }
        const internalKey = 'b'
        value[internalKey] = undefined
        modifyCache(options.cacheKey, value)
        throw e
      })
    })
    const fetchCached = (request, cached) => {
      t.deepEqual(cached, {
        a: 'value',
        b: undefined
      })
      return {
        b: 'value'
      }
    }

    const cached = processCache(options, fetch, cacheRequest)
    const request = {
      internal: cached.value
    }
    try {
      await getInternal(true, request)
    } catch (e) {
      let cache = getCache(options.cacheKey)

      t.true(cache.modified)
      t.deepEqual(cache.value, {
        a: 'value',
        b: undefined
      })
      t.is(e.message, 'Failed to resolve internal values')
      t.deepEqual(e.cause, [new Error('error')])

      processCache(options, fetchCached, cacheRequest)
      cache = getCache(options.cacheKey)

      t.is(cache.modified, undefined)
      t.deepEqual(cache.value, {
        a: 'value',
        b: 'value'
      })
    }
    clearCache()
  }
)

test.serial('processCache should cache and expire', async (t) => {
  const fetch = sinon.stub().resolves('value')
  const options = {
    cacheKey: 'key',
    cacheExpiry: 150
  }
  processCache(options, fetch, cacheRequest)
  await setTimeout(100)
  let cache = getCache('key')
  t.not(cache, undefined)
  await setTimeout(100)
  cache = getCache('key')
  t.true(cache.expiry > Date.now())
  t.is(fetch.callCount, 2)
  clearCache()
})

test.serial('processCache should clear single key cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  processCache(
    {
      cacheKey: 'key',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  processCache(
    {
      cacheKey: 'other',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  clearCache('other')
  t.not(getCache('key').value, undefined)
  t.deepEqual(getCache('other'), {})
  clearCache()
})

test.serial('processCache should clear multi key cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  processCache(
    {
      cacheKey: 'key',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  processCache(
    {
      cacheKey: 'other',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  clearCache(['key', 'other'])
  t.deepEqual(getCache('key'), {})
  t.deepEqual(getCache('other'), {})
  clearCache()
})

test.serial('processCache should clear all cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  processCache(
    {
      cacheKey: 'key',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  processCache(
    {
      cacheKey: 'other',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  clearCache()
  t.deepEqual(getCache('key'), {})
  t.deepEqual(getCache('other'), {})
  clearCache()
})

// modifyCache
test.serial(
  'modifyCache should not override value when it does not exist',
  async (t) => {
    modifyCache('key')
    t.deepEqual(getCache('key'), {})
  }
)

// jsonSafeParse
test('jsonSafeParse should parse valid json', async (t) => {
  const value = jsonSafeParse('{}')
  t.deepEqual(value, {})
})
test('jsonSafeParse should not parse object', async (t) => {
  const value = jsonSafeParse({})
  t.deepEqual(value, {})
})
test('jsonSafeParse should not parse string', async (t) => {
  const value = jsonSafeParse('value')
  t.is(value, 'value')
})
test('jsonSafeParse should not parse empty string', async (t) => {
  const value = jsonSafeParse('')
  t.is(value, '')
})
test('jsonSafeParse should not parse null', async (t) => {
  const value = jsonSafeParse(null)
  t.is(value, null)
})
test('jsonSafeParse should not parse number', async (t) => {
  const value = jsonSafeParse(1)
  t.is(value, 1)
})

test('jsonSafeParse should not parse nested function', async (t) => {
  const value = jsonSafeParse('{fct:() => {}}')
  t.is(value, '{fct:() => {}}')
})

// jsonSafeStringify
test('jsonSafeStringify should stringify valid json', async (t) => {
  const value = jsonSafeStringify({ hello: ['world'] })
  t.is(value, '{"hello":["world"]}')
})
test('jsonSafeStringify should stringify with replacer', async (t) => {
  const value = jsonSafeStringify(
    JSON.stringify({ msg: JSON.stringify({ hello: ['world'] }) }),
    (key, value) => jsonSafeParse(value)
  )
  t.is(value, '{"msg":{"hello":["world"]}}')
})
test('jsonSafeStringify should not stringify if throws error', async (t) => {
  const value = jsonSafeStringify({ bigint: BigInt(9007199254740991) })
  t.deepEqual(value, { bigint: BigInt(9007199254740991) })
})

// normalizeHttpResponse
test('normalizeHttpResponse should not change response', async (t) => {
  const request = {
    response: { headers: {} }
  }
  normalizeHttpResponse(request)
  t.deepEqual(request, { response: { statusCode: 500, headers: {} } })
})
test('normalizeHttpResponse should update headers in response', async (t) => {
  const request = {
    response: {}
  }
  normalizeHttpResponse(request)
  t.deepEqual(request, { response: { statusCode: 200, headers: {}, body: {} } })
})

test('normalizeHttpResponse should update undefined response', async (t) => {
  const request = {}
  normalizeHttpResponse(request)
  t.deepEqual(request, { response: { statusCode: 500, headers: {} } })
})

test('normalizeHttpResponse should update incomplete response', async (t) => {
  const request = {
    response: {
      body: ''
    }
  }
  normalizeHttpResponse(request)
  t.deepEqual(request, { response: { statusCode: 500, headers: {}, body: '' } })
})

test('normalizeHttpResponse should update nullish response', async (t) => {
  const request = {
    response: null
  }
  normalizeHttpResponse(request)
  t.deepEqual(request, {
    response: { statusCode: 200, headers: {}, body: null }
  })
})

test('normalizeHttpResponse should update string response', async (t) => {
  const request = {
    response: ''
  }
  normalizeHttpResponse(request)
  t.deepEqual(request, { response: { statusCode: 200, headers: {}, body: '' } })
})
test('normalizeHttpResponse should update array response', async (t) => {
  const request = {
    response: []
  }
  normalizeHttpResponse(request)
  t.deepEqual(request, { response: { statusCode: 200, headers: {}, body: [] } })
})

// HttpError
test('HttpError should create error', async (t) => {
  const e = new HttpError(400, 'message', { cause: 'cause' })
  t.is(e.status, 400)
  t.is(e.statusCode, 400)
  t.is(e.name, 'BadRequestError')
  t.is(e.message, 'message')
  t.is(e.expose, true)
  t.is(e.cause, 'cause')
})
test('HttpError should create error with expose false', async (t) => {
  const e = new HttpError(500, { cause: 'cause' })
  t.is(e.status, 500)
  t.is(e.statusCode, 500)
  t.is(e.name, 'InternalServerError')
  t.is(e.message, 'Internal Server Error')
  t.is(e.expose, false)
  t.is(e.cause, 'cause')
})

// createError
test('createError should create error', async (t) => {
  const e = createError(400, 'message', { cause: 'cause' })
  t.is(e.status, 400)
  t.is(e.statusCode, 400)
  t.is(e.name, 'BadRequestError')
  t.is(e.message, 'message')
  t.is(e.expose, true)
  t.is(e.cause, 'cause')
})

test('createError should create error with expose false', async (t) => {
  const e = createError(500)
  t.is(e.status, 500)
  t.is(e.statusCode, 500)
  t.is(e.name, 'InternalServerError')
  t.is(e.message, 'Internal Server Error')
  t.is(e.expose, false)
})

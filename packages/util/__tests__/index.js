import test from 'ava'
import sinon from 'sinon'
import util from '../index.js'

process.env.AWS_REGION = 'ca-central-1'

// requestHandler: aws-sdk v3
// httpOptions: aws-sdk v2

const delay = async (ms, x) => {
  return new Promise((resolve) => setTimeout(() => resolve(x), ms))
}

// createClient
test('createClient should create AWS Client', async (t) => {
  const Client = sinon.spy()

  await util.createClient({
    AwsClient: Client
  })
  t.is(Client.callCount, 1)
  t.deepEqual(Object.keys(Client.args[0][0]), ['httpOptions'])
})

test('createClient should create AWS Client with options', async (t) => {
  const Client = sinon.spy()

  await util.createClient({
    AwsClient: Client,
    awsClientOptions: { apiVersion: '2014-11-06' }
  })
  t.is(Client.callCount, 1)
  t.deepEqual(Object.keys(Client.args[0][0]), ['httpOptions', 'apiVersion'])
  t.is(Client.args[0][0].apiVersion, '2014-11-06')
})

test('createClient should throw when creating AWS Client with role and no request', async (t) => {
  const Client = sinon.spy()

  try {
    await util.createClient({
      AwsClient: Client,
      awsClientAssumeRole: 'adminRole'
    })
  } catch (e) {
    t.is(e.message, 'Request required when assuming role')
  }
})

test('createClient should create AWS Client with role', async (t) => {
  const Client = sinon.spy()

  const request = {
    internal: {
      adminRole: 'creds object'
    }
  }
  await util.createClient(
    {
      AwsClient: Client,
      awsClientAssumeRole: 'adminRole'
    },
    request
  )
  t.is(Client.callCount, 1)
  t.deepEqual(Object.keys(Client.args[0][0]), ['httpOptions', 'credentials'])
  t.is(Client.args[0][0].credentials, 'creds object')
})

test('createClient should create AWS Client with role from promise', async (t) => {
  const Client = sinon.spy()

  const request = {
    internal: {
      adminRole: Promise.resolve('creds object')
    }
  }
  await util.createClient(
    {
      AwsClient: Client,
      awsClientAssumeRole: 'adminRole'
    },
    request
  )
  t.is(Client.callCount, 1)
  t.deepEqual(Object.keys(Client.args[0][0]), ['httpOptions', 'credentials'])
  t.is(Client.args[0][0].credentials, 'creds object')
})

// canPrefetch
test('canPrefetch should prefetch', async (t) => {
  const prefetch = util.canPrefetch()
  t.is(prefetch, true)
})

test('canPrefetch should not prefetch with assume role set', async (t) => {
  const prefetch = util.canPrefetch({
    awsClientAssumeRole: 'admin'
  })
  t.is(prefetch, false)
})

test('canPrefetch should not prefetch when disabled', async (t) => {
  const prefetch = util.canPrefetch({
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
  const values = await util.getInternal(false, getInternalRequest)
  t.deepEqual(values, {})
})

test('getInternal should get all from internal store', async (t) => {
  const values = await util.getInternal(true, getInternalRequest)
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
  const values = await util.getInternal('number', getInternalRequest)
  t.deepEqual(values, { number: 1 })
})

test('getInternal should get from internal store when array[string]', async (t) => {
  const values = await util.getInternal(
    ['boolean', 'string'],
    getInternalRequest
  )
  t.deepEqual(values, { boolean: true, string: 'string' })
})

test('getInternal should get from internal store when object', async (t) => {
  const values = await util.getInternal(
    { newKey: 'promise' },
    getInternalRequest
  )
  t.deepEqual(values, { newKey: 'promise' })
})

test('getInternal should get from internal store a nested value', async (t) => {
  const values = await util.getInternal('promiseObject.key', getInternalRequest)
  t.deepEqual(values, { promiseObject_key: 'value' })
})

// sanitizeKey
test('sanitizeKey should sanitize key', async (t) => {
  const key = util.sanitizeKey('api//secret-key0.pem')
  t.is(key, 'api_secret_key0_pem')
})

test('sanitizeKey should sanitize key with leading number', async (t) => {
  const key = util.sanitizeKey('0key')
  t.is(key, '_0key')
})

test('sanitizeKey should not sanitize key', async (t) => {
  const key = util.sanitizeKey('api_secret_key0_pem')
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
  util.processCache(options, fetch, cacheRequest)
  const cache = util.getCache('key')
  t.deepEqual(cache, {})
  util.clearCache()
})

test.serial('processCache should cache forever', async (t) => {
  const fetch = sinon.stub().resolves('value')
  const options = {
    cacheKey: 'key',
    cacheExpiry: -1
  }
  util.processCache(options, fetch, cacheRequest)
  await delay(100)
  const cacheValue = util.getCache('key').value
  t.is(await cacheValue, 'value')
  const { value, cache } = util.processCache(options, fetch, cacheRequest)
  t.is(await value, 'value')
  t.true(cache)
  util.clearCache()
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
        const value = util.getCache(options.cacheKey).value || { value: {} }
        const internalKey = 'b'
        value[internalKey] = undefined
        util.modifyCache(options.cacheKey, value)
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

    const cached = util.processCache(options, fetch, cacheRequest)
    const request = {
      internal: cached.value
    }
    try {
      await util.getInternal(true, request)
    } catch (e) {
      let cache = util.getCache(options.cacheKey)

      t.true(cache.modified)
      t.deepEqual(cache.value, {
        a: 'value',
        b: undefined
      })
      t.is(e.message, 'Failed to resolve internal values')
      t.deepEqual(e.cause, [new Error('error')])

      util.processCache(options, fetchCached, cacheRequest)
      cache = util.getCache(options.cacheKey)

      t.is(cache.modified, undefined)
      t.deepEqual(cache.value, {
        a: 'value',
        b: 'value'
      })
    }
    util.clearCache()
  }
)

test.serial('processCache should cache and expire', async (t) => {
  const fetch = sinon.stub().resolves('value')
  const options = {
    cacheKey: 'key',
    cacheExpiry: 150
  }
  util.processCache(options, fetch, cacheRequest)
  await delay(100)
  let cache = util.getCache('key')
  t.not(cache, undefined)
  await delay(100)
  cache = util.getCache('key')
  t.true(cache.expiry < Date.now())
  util.clearCache()
})

test.serial('processCache should clear single key cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  util.processCache(
    {
      cacheKey: 'key',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  util.processCache(
    {
      cacheKey: 'other',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  util.clearCache('other')
  t.not(util.getCache('key').value, undefined)
  t.deepEqual(util.getCache('other'), {})
  util.clearCache()
})

test.serial('processCache should clear multi key cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  util.processCache(
    {
      cacheKey: 'key',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  util.processCache(
    {
      cacheKey: 'other',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  util.clearCache(['key', 'other'])
  t.deepEqual(util.getCache('key'), {})
  t.deepEqual(util.getCache('other'), {})
  util.clearCache()
})

test.serial('processCache should clear all cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  util.processCache(
    {
      cacheKey: 'key',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  util.processCache(
    {
      cacheKey: 'other',
      cacheExpiry: -1
    },
    fetch,
    cacheRequest
  )
  util.clearCache()
  t.deepEqual(util.getCache('key'), {})
  t.deepEqual(util.getCache('other'), {})
  util.clearCache()
})

// jsonSafeParse
test('jsonSafeParse should parse valid json', async (t) => {
  const value = util.jsonSafeParse('{}')
  t.deepEqual(value, {})
})
test('jsonSafeParse should not parse object', async (t) => {
  const value = util.jsonSafeParse({})
  t.deepEqual(value, {})
})
test('jsonSafeParse should not parse string', async (t) => {
  const value = util.jsonSafeParse('value')
  t.is(value, 'value')
})
test('jsonSafeParse should not parse empty string', async (t) => {
  const value = util.jsonSafeParse('')
  t.is(value, '')
})
test('jsonSafeParse should not parse null', async (t) => {
  const value = util.jsonSafeParse(null)
  t.is(value, null)
})
test('jsonSafeParse should not parse number', async (t) => {
  const value = util.jsonSafeParse(1)
  t.is(value, 1)
})

// normalizeHttpResponse
test('normalizeHttpResponse should not change response', async (t) => {
  const request = {
    response: { headers: {} }
  }
  util.normalizeHttpResponse(request)
  t.deepEqual(request, { response: { headers: {} } })
})
test('normalizeHttpResponse should update headers in response', async (t) => {
  const request = {
    response: {}
  }
  util.normalizeHttpResponse(request)
  t.deepEqual(request, { response: { headers: {}, body: {} } })
})

test('normalizeHttpResponse should update undefined response', async (t) => {
  const request = {}
  util.normalizeHttpResponse(request)
  t.deepEqual(request, { response: { headers: {} } })
})

test('normalizeHttpResponse should update nullish response', async (t) => {
  const request = {
    response: null
  }
  util.normalizeHttpResponse(request)
  t.deepEqual(request, { response: { headers: {}, body: null } })
})

test('normalizeHttpResponse should update string response', async (t) => {
  const request = {
    response: ''
  }
  util.normalizeHttpResponse(request)
  t.deepEqual(request, { response: { headers: {}, body: '' } })
})
test('normalizeHttpResponse should update array response', async (t) => {
  const request = {
    response: []
  }
  util.normalizeHttpResponse(request)
  t.deepEqual(request, { response: { headers: {}, body: [] } })
})

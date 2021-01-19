const test = require('ava')
const sinon = require('sinon')
const util = require('../index.js')

process.env.AWS_REGION = 'ca-central-1'

// httpOptions: aws-sdk v3
// httpOptions: aws-sdk v2

const delay = async (ms, x) => {
  return new Promise(resolve => setTimeout(() => resolve(x), ms))
}

// createClient
test('It should create AWS Client', async (t) => {
  const Client = sinon.spy()

  await util.createClient({
    AwsClient: Client
  })
  t.is(Client.callCount, 1)
  t.deepEqual(Object.keys(Client.args[0][0]), ['httpOptions'])
})

test('It should create AWS Client with options', async (t) => {
  const Client = sinon.spy()

  await util.createClient({
    AwsClient: Client,
    awsClientOptions: { apiVersion: '2014-11-06' }
  })
  t.is(Client.callCount, 1)
  t.deepEqual(Object.keys(Client.args[0][0]), ['httpOptions', 'apiVersion'])
  t.is(Client.args[0][0].apiVersion, '2014-11-06')
})

test('It should throw when creating AWS Client with role and no handler', async (t) => {
  const Client = sinon.spy()

  try {
    await util.createClient({
      AwsClient: Client,
      awsClientAssumeRole: 'adminRole'
    })
  } catch (e) {
    t.is(e.message, 'Handler required when assuming role')
  }
})

test('It should create AWS Client with role', async (t) => {
  const Client = sinon.spy()

  const handler = {
    internal: {
      adminRole: 'creds object'
    }
  }
  await util.createClient({
    AwsClient: Client,
    awsClientAssumeRole: 'adminRole'
  }, handler)
  t.is(Client.callCount, 1)
  t.deepEqual(Object.keys(Client.args[0][0]), ['httpOptions', 'credentials'])
  t.is(Client.args[0][0].credentials, 'creds object')
})

test('It should create AWS Client with role from promise', async (t) => {
  const Client = sinon.spy()

  const handler = {
    internal: {
      adminRole: Promise.resolve('creds object')
    }
  }
  await util.createClient({
    AwsClient: Client,
    awsClientAssumeRole: 'adminRole'
  }, handler)
  t.is(Client.callCount, 1)
  t.deepEqual(Object.keys(Client.args[0][0]), ['httpOptions', 'credentials'])
  t.is(Client.args[0][0].credentials, 'creds object')
})

// canPrefetch
test('It should prefetch', async (t) => {
  const prefetch = util.canPrefetch()
  t.is(prefetch, true)
})

test('It should not prefetch with assume role set', async (t) => {
  const prefetch = util.canPrefetch({
    awsClientAssumeRole: 'admin'
  })
  t.is(prefetch, false)
})

test('It should not prefetch when disabled', async (t) => {
  const prefetch = util.canPrefetch({
    disablePrefetch: true
  })
  t.is(prefetch, false)
})

// getInternal
const getInternalHandler = {
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
    }),
  }
}
test('It should get none from internal store', async (t) => {
  const values = await util.getInternal(false, getInternalHandler)
  t.deepEqual(values, {})
})

test('It should get all from internal store', async (t) => {
  const values = await util.getInternal(true, getInternalHandler)
  t.deepEqual(values, {
    array: [],
    boolean: true,
    number: 1,
    object: {
      key: 'value',
    },
    promise: 'promise',
    promiseObject: {
      key: 'value',
    },
    string: 'string',
  })
})

test('It should get from internal store when string', async (t) => {
  const values = await util.getInternal('number', getInternalHandler)
  t.deepEqual(values, { number: 1 })
})

test('It should get from internal store when array[string]', async (t) => {
  const values = await util.getInternal(['boolean', 'string'], getInternalHandler)
  t.deepEqual(values, { boolean: true, string: 'string' })
})

test('It should get from internal store when object', async (t) => {
  const values = await util.getInternal({ newKey: 'promise' }, getInternalHandler)
  t.deepEqual(values, { newKey: 'promise' })
})

test('It should get from internal store a nested value', async (t) => {
  const values = await util.getInternal('promiseObject.key', getInternalHandler)
  t.deepEqual(values, { promiseObject_key: 'value' })
})

// sanitizeKey
test('It should sanitize key', async (t) => {
  const key = util.sanitizeKey('api//secret-key0.pem')
  t.is(key, 'api_secret_key0_pem')
})

test('It should sanitize key with leading number', async (t) => {
  const key = util.sanitizeKey('0key')
  t.is(key, '_0key')
})

test('It should not sanitize key', async (t) => {
  const key = util.sanitizeKey('api_secret_key0_pem')
  t.is(key, 'api_secret_key0_pem')
})

// processCache / clearCache
const cacheHandler = {
  internal: {}
}
test.serial('It should not cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  const options = {
    cacheKey: 'key',
    cacheExpiry: 0
  }
  util.processCache(options, fetch, cacheHandler)
  const cache = util.getCache('key')
  t.is(cache, undefined)
  util.clearCache()
})

test.serial('It should cache forever', async (t) => {
  const fetch = sinon.stub().resolves('value')
  const options = {
    cacheKey: 'key',
    cacheExpiry: -1
  }
  util.processCache(options, fetch, cacheHandler)
  await delay(100)
  const cache = util.getCache('key')
  t.not(cache, undefined)
  const cached = await util.processCache(options, fetch, cacheHandler)
  t.is(cached, 'value')
  util.clearCache()
})

test.serial('It should cache and expire', async (t) => {
  const fetch = sinon.stub().resolves('value')
  const options = {
    cacheKey: 'key',
    cacheExpiry: 150
  }
  util.processCache(options, fetch, cacheHandler)
  await delay(100)
  let cache = util.getCache('key')
  t.not(cache, undefined)
  await delay(100)
  cache = util.getCache('key')
  t.true(cache.expiry < Date.now() )
  util.clearCache()
})

test.serial('It should clear single key cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  util.processCache({
    cacheKey: 'key',
    cacheExpiry: -1
  }, fetch, cacheHandler)
  util.processCache({
    cacheKey: 'other',
    cacheExpiry: -1
  }, fetch, cacheHandler)
  util.clearCache('other')
  t.not(util.getCache('key'), undefined)
  t.is(util.getCache('other'), undefined)
  util.clearCache()
})

test.serial('It should clear multi key cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  util.processCache({
    cacheKey: 'key',
    cacheExpiry: -1
  }, fetch, cacheHandler)
  util.processCache({
    cacheKey: 'other',
    cacheExpiry: -1
  }, fetch, cacheHandler)
  util.clearCache(['key','other'])
  t.is(util.getCache('key'), undefined)
  t.is(util.getCache('other'), undefined)
  util.clearCache()
})

test.serial('It should clear all cache', async (t) => {
  const fetch = sinon.stub().resolves('value')
  util.processCache({
    cacheKey: 'key',
    cacheExpiry: -1
  }, fetch, cacheHandler)
  util.processCache({
    cacheKey: 'other',
    cacheExpiry: -1
  }, fetch, cacheHandler)
  util.clearCache()
  t.is(util.getCache('key'), undefined)
  t.is(util.getCache('other'), undefined)
  util.clearCache()
})

// jsonSafeParse
test('It should parse valid json', async (t) => {
  const value = util.jsonSafeParse('{}')
  t.deepEqual(value, {})
})
test('It should not parse object', async (t) => {
  const value = util.jsonSafeParse({})
  t.deepEqual(value, {})
})
test('It should not parse string', async (t) => {
  const value = util.jsonSafeParse('value')
  t.is(value, 'value')
})
test('It should not parse empty string', async (t) => {
  const value = util.jsonSafeParse('')
  t.is(value, '')
})
test('It should not parse null', async (t) => {
  const value = util.jsonSafeParse(null)
  t.is(value, null)
})
test('It should not parse number', async (t) => {
  const value = util.jsonSafeParse(1)
  t.is(value, 1)
})

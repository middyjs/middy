import test from 'ava'
import sinon from 'sinon'
import { SSM } from '@aws-sdk/client-ssm'
import { getInternal, clearCache } from '../../core/util.js'
import middy from '../../core/index.js'
import ssm from '../index.js'

let sandbox
test.beforeEach(t => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

test.serial('It should set SSM param value to internal storage', async (t) => {
  sandbox.stub(SSM.prototype, 'getParameters').resolves({
    Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.key, 'key-value')
  }

  handler
    .use(ssm({
      AwsClient: SSM,
      fetchData: {
        key: '/dev/service_name/key_name'
      }
    }))
    .before(middleware)

  await handler()

})

test.serial('It should set SSM param value to internal storage without prefetch', async (t) => {
  sandbox.stub(SSM.prototype, 'getParameters').resolves({
    Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.key, 'key-value')
  }

  handler
    .use(ssm({
      AwsClient: SSM,
      fetchData: {
        key: '/dev/service_name/key_name'
      },
      disablePrefetch: true
    }))
    .before(middleware)

  await handler()

})

test.serial('It should set SSM param value to context', async (t) => {
  sandbox.stub(SSM.prototype, 'getParameters').resolves({
    Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    t.is(handler.context.key, 'key-value')
  }

  handler
    .use(ssm({
      AwsClient: SSM,
      fetchData: {
        key: '/dev/service_name/key_name'
      },
      setContext: true
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set SSM param value to process.env', async (t) => {
  sandbox.stub(SSM.prototype, 'getParameters').resolves({
    Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    t.is(process.env.key, 'key-value')
  }

  handler
    .use(ssm({
      AwsClient: SSM,
      fetchData: {
        key: '/dev/service_name/key_name'
      },
      setProcessEnv: true
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set SSM param value to internal storage when request > 10 params', async (t) => {
  sandbox.stub(SSM.prototype, 'getParameters')
    .onFirstCall().resolves({
      Parameters: [
        { Name: '/dev/service_name/key_name0', Value: 'key-value0' },
        { Name: '/dev/service_name/key_name1', Value: 'key-value1' },
        { Name: '/dev/service_name/key_name2', Value: 'key-value2' },
        { Name: '/dev/service_name/key_name3', Value: 'key-value3' },
        { Name: '/dev/service_name/key_name4', Value: 'key-value4' },
        { Name: '/dev/service_name/key_name5', Value: 'key-value5' },
        { Name: '/dev/service_name/key_name6', Value: 'key-value6' },
        { Name: '/dev/service_name/key_name7', Value: 'key-value7' },
        { Name: '/dev/service_name/key_name8', Value: 'key-value8' },
        { Name: '/dev/service_name/key_name9', Value: 'key-value9' },
      ]
    })
    .onSecondCall().resolves({
      Parameters: [
        { Name: '/dev/service_name/key_name10', Value: 'key-value10' },
        { Name: '/dev/service_name/key_name11', Value: 'key-value11' },
        { Name: '/dev/service_name/key_name12', Value: 'key-value12' },
        { Name: '/dev/service_name/key_name13', Value: 'key-value13' },
        { Name: '/dev/service_name/key_name14', Value: 'key-value14' },
        { Name: '/dev/service_name/key_name15', Value: 'key-value15' },
        { Name: '/dev/service_name/key_name16', Value: 'key-value16' },
        { Name: '/dev/service_name/key_name17', Value: 'key-value17' },
        { Name: '/dev/service_name/key_name18', Value: 'key-value18' },
        { Name: '/dev/service_name/key_name19', Value: 'key-value19' },
      ]
    })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.key11, 'key-value11')
  }

  handler
    .use(ssm({
      AwsClient: SSM,
      fetchData: {
        key0: '/dev/service_name/key_name0',
        key1: '/dev/service_name/key_name1',
        key2: '/dev/service_name/key_name2',
        key3: '/dev/service_name/key_name3',
        key4: '/dev/service_name/key_name4',
        key5: '/dev/service_name/key_name5',
        key6: '/dev/service_name/key_name6',
        key7: '/dev/service_name/key_name7',
        key8: '/dev/service_name/key_name8',
        key9: '/dev/service_name/key_name9',
        key10: '/dev/service_name/key_name10',
        key11: '/dev/service_name/key_name11',
        key12: '/dev/service_name/key_name12',
        key13: '/dev/service_name/key_name13',
        key14: '/dev/service_name/key_name14',
      }
    }))
    .before(middleware)

  await handler()
})

test.serial('It should not call aws-sdk again if parameter is cached', async (t) => {
  const stub = sandbox.stub(SSM.prototype, 'getParameters').resolves({
    Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.key, 'key-value')
  }

  handler
    .use(ssm({
      AwsClient: SSM,
      fetchData: {
        key: '/dev/service_name/key_name'
      }
    }))
    .before(middleware)

  await handler()
  await handler()

  t.is(stub.callCount, 1)
})

test.serial('It should call aws-sdk if cache enabled but cached param has expired', async (t) => {
  const stub = sandbox.stub(SSM.prototype, 'getParameters').resolves({
    Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.key, 'key-value')
  }

  handler
    .use(ssm({
      AwsClient: SSM,
      fetchData: {
        key: '/dev/service_name/key_name'
      },
      cacheExpiry: 0
    }))
    .before(middleware)

  await handler()
  await handler()

  t.is(stub.callCount, 2)
})

test('It should throw error if InvalidParameters returned', async (t) => {
  sandbox.stub(SSM.prototype, 'getParameters').resolves({
    InvalidParameters: ['invalid-smm-param-name', 'another-invalid-ssm-param']
  })

  const handler = middy((handler) => {})

  handler
    .use(ssm({
      AwsClient: SSM,
      fetchData: {
        key: '/dev/service_name/key_name'
      },
      setContext: true
    }))

  try {
    await handler()
    t.true(true)
  } catch (e) {
    t.is(e.message, 'InvalidParameters present: invalid-smm-param-name, another-invalid-ssm-param')
  }

})


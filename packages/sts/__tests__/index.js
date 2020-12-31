import test from 'ava'
import sinon from 'sinon'
import { STS } from '@aws-sdk/client-sts'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../core/util.js'
import sts from '../index.js'

let sandbox
test.beforeEach(t => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

test.serial('It should set credential to internal storage', async (t) => {
  sandbox.stub(STS.prototype, 'assumeRole').resolves({
    Credentials: {
      AccessKeyId: 'accessKeyId',
      SecretAccessKey: 'secretAccessKey',
      SessionToken: 'sessionToken'
    }
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.deepEqual(values.role, {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken'
    })
  }

  handler
    .use(sts({
      AwsClient: STS,
      fetchData: {
        role: {
          RoleArn: '.../role'
        }
      }
    }))
    .before(middleware)

  await handler()
})

test.serial('It should set STS secret to internal storage without prefetch', async (t) => {
  sandbox.stub(STS.prototype, 'assumeRole').resolves({
    Credentials: {
      AccessKeyId: 'accessKeyId',
      SecretAccessKey: 'secretAccessKey',
      SessionToken: 'sessionToken'
    }
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.deepEqual(values.role, {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken'
    })
  }

  handler
    .use(sts({
      AwsClient: STS,
      fetchData: {
        role: {
          RoleArn: '.../role'
        }
      },
      disablePrefetch: true
    }))
    .before(middleware)

  await handler()

})

test.serial('It should set STS secret to context', async (t) => {
  sandbox.stub(STS.prototype, 'assumeRole').resolves({
    Credentials: {
      AccessKeyId: 'accessKeyId',
      SecretAccessKey: 'secretAccessKey',
      SessionToken: 'sessionToken'
    }
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    t.deepEqual(handler.context.role, {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken'
    })
  }

  handler
    .use(sts({
      AwsClient: STS,
      fetchData: {
        role: {
          RoleArn: '.../role'
        }
      },
      setContext: true
    }))
    .before(middleware)

  await handler()
})

test.serial('It should not call aws-sdk again if parameter is cached', async (t) => {
  const stub = sandbox.stub(STS.prototype, 'assumeRole').resolves({
    Credentials: {
      AccessKeyId: 'accessKeyId',
      SecretAccessKey: 'secretAccessKey',
      SessionToken: 'sessionToken'
    }
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.deepEqual(values.role, {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken'
    })
  }

  handler
    .use(sts({
      AwsClient: STS,
      fetchData: {
        role: {
          RoleArn: '.../role'
        }
      }
    }))
    .before(middleware)

  await handler()
  await handler()

  t.is(stub.callCount, 1)
})

test.serial('It should call aws-sdk if cache enabled but cached param has expired', async (t) => {
  const stub = sandbox.stub(STS.prototype, 'assumeRole').resolves({
    Credentials: {
      AccessKeyId: 'accessKeyId',
      SecretAccessKey: 'secretAccessKey',
      SessionToken: 'sessionToken'
    }
  })

  const handler = middy((handler) => {})

  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.deepEqual(values.role, {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken'
    })
  }

  handler
    .use(sts({
      AwsClient: STS,
      fetchData: {
        role: {
          RoleArn: '.../role'
        }
      },
      cacheExpiry: 0
    }))
    .before(middleware)

  await handler()
  await handler()

  t.is(stub.callCount, 2)
})

import test from 'ava'
import sinon from 'sinon'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import sts from '../index.js'

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

test.serial('It should set credential to internal storage', async (t) => {
  mockClient(STSClient)
    .on(AssumeRoleCommand)
    .resolvesOnce({
      Credentials: {
        AccessKeyId: 'accessKeyId',
        SecretAccessKey: 'secretAccessKey',
        SessionToken: 'sessionToken'
      }
    })

  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    t.deepEqual(values.role, {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken'
    })
  }

  handler
    .use(
      sts({
        AwsClient: STSClient,
        cacheExpiry: 0,
        fetchData: {
          role: {
            RoleArn: '.../role'
          }
        },
        disablePrefetch: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should set STS secret to internal storage without prefetch',
  async (t) => {
    mockClient(STSClient)
      .on(AssumeRoleCommand)
      .resolvesOnce({
        Credentials: {
          AccessKeyId: 'accessKeyId',
          SecretAccessKey: 'secretAccessKey',
          SessionToken: 'sessionToken'
        }
      })

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.deepEqual(values.role, {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken'
      })
    }

    handler
      .use(
        sts({
          AwsClient: STSClient,
          cacheExpiry: 0,
          fetchData: {
            role: {
              RoleArn: '.../role'
            }
          },
          disablePrefetch: true
        })
      )
      .before(middleware)

    await handler(event, context)
  }
)

test.serial('It should set STS secret to context', async (t) => {
  mockClient(STSClient)
    .on(AssumeRoleCommand)
    .resolvesOnce({
      Credentials: {
        AccessKeyId: 'accessKeyId',
        SecretAccessKey: 'secretAccessKey',
        SessionToken: 'sessionToken'
      }
    })

  const handler = middy(() => {})

  const middleware = async (request) => {
    t.deepEqual(request.context.role, {
      accessKeyId: 'accessKeyId',
      secretAccessKey: 'secretAccessKey',
      sessionToken: 'sessionToken'
    })
  }

  handler
    .use(
      sts({
        AwsClient: STSClient,
        cacheExpiry: 0,
        fetchData: {
          role: {
            RoleArn: '.../role'
          }
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
    const mockService = mockClient(STSClient)
      .on(AssumeRoleCommand)
      .resolvesOnce({
        Credentials: {
          AccessKeyId: 'accessKeyId',
          SecretAccessKey: 'secretAccessKey',
          SessionToken: 'sessionToken'
        }
      })
    const sendStub = mockService.send

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.deepEqual(values.role, {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken'
      })
    }

    handler
      .use(
        sts({
          AwsClient: STSClient,
          cacheExpiry: -1,
          fetchData: {
            role: {
              RoleArn: '.../role'
            }
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
    const mockService = mockClient(STSClient)
      .on(AssumeRoleCommand)
      .resolves({
        Credentials: {
          AccessKeyId: 'accessKeyId',
          SecretAccessKey: 'secretAccessKey',
          SessionToken: 'sessionToken'
        }
      })
    const sendStub = mockService.send

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.deepEqual(values.role, {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken'
      })
    }

    handler
      .use(
        sts({
          AwsClient: STSClient,
          cacheExpiry: 0,
          fetchData: {
            role: {
              RoleArn: '.../role'
            }
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
  const mockService = mockClient(STSClient)
    .on(AssumeRoleCommand)
    .rejects('timeout')
  const sendStub = mockService.send

  const handler = middy(() => {}).use(
    sts({
      AwsClient: STSClient,
      cacheExpiry: 0,
      fetchData: {
        role: {
          RoleArn: '.../role'
        }
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
    t.deepEqual(e.cause, [new Error('timeout')])
  }
})

import test from 'ava'
import sinon from 'sinon'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import {
  AppConfigClient,
  GetConfigurationCommand
} from '@aws-sdk/client-appconfig'
import appConfig from '../index.js'

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

const strToUintArray = (str) =>
  Uint8Array.from(str.split('').map((x) => x.charCodeAt()))

test.serial(
  'It should set AppConfig param value to internal storage',
  async (t) => {
    mockClient(AppConfigClient)
      .on(GetConfigurationCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        Content: strToUintArray('{"option":"value"}')
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.option, 'value')
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              Application: '...',
              ClientId: '...',
              Configuration: '...',
              Environment: '...'
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
  }
)

test.serial(
  'It should set AppConfig param value to internal storage without prefetch',
  async (t) => {
    mockClient(AppConfigClient)
      .on(GetConfigurationCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        Content: strToUintArray('{"option":"value"}')
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.option, 'value')
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              Application: '...',
              ClientId: '...',
              Configuration: '...',
              Environment: '...'
            }
          },
          disablePrefetch: true
        })
      )
      .before(middleware)

    await handler(event, context)
  }
)

test.serial('It should set AppConfig param value to context', async (t) => {
  mockClient(AppConfigClient)
    .on(GetConfigurationCommand)
    .resolvesOnce({
      ContentType: 'application/json',
      Content: strToUintArray('{"option":"value"}')
    })

  const middleware = async (request) => {
    t.is(request.context.key?.option, 'value')
  }

  const handler = middy(() => {})
    .use(
      appConfig({
        AwsClient: AppConfigClient,
        cacheExpiry: 0,
        fetchData: {
          key: {
            Application: '...',
            ClientId: '...',
            Configuration: '...',
            Environment: '...'
          }
        },
        setToContext: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should not call aws-sdk again if parameter is cached forever',
  async (t) => {
    const mockService = mockClient(AppConfigClient)
      .on(GetConfigurationCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        Content: strToUintArray('{"option":"value"}')
      })
    const sendStub = mockService.send
    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.option, 'value')
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigClient,
          cacheExpiry: -1,
          fetchData: {
            key: {
              Application: '...',
              ClientId: '...',
              Configuration: '...',
              Environment: '...'
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
  'It should not call aws-sdk again if parameter is cached',
  async (t) => {
    const mockService = mockClient(AppConfigClient)
      .on(GetConfigurationCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        Content: strToUintArray('{"option":"value"}')
      })
    const sendStub = mockService.send

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.option, 'value')
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigClient,
          cacheExpiry: 1000,
          fetchData: {
            key: {
              Application: '...',
              ClientId: '...',
              Configuration: '...',
              Environment: '...'
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
    const mockService = mockClient(AppConfigClient)
      .on(GetConfigurationCommand)
      .resolves({
        ContentType: 'application/json',
        Content: strToUintArray('{"option":"value"}')
      })
    const sendStub = mockService.send

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.option, 'value')
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              Application: '...',
              ClientId: '...',
              Configuration: '...',
              Environment: '...'
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(sendStub.callCount, 2)
  }
)

test.serial('It should catch if an error is returned from fetch', async (t) => {
  const mockService = mockClient(AppConfigClient)
    .on(GetConfigurationCommand)
    .rejects('timeout')
  const sendStub = mockService.send

  const handler = middy(() => {}).use(
    appConfig({
      AwsClient: AppConfigClient,
      cacheExpiry: 0,
      fetchData: {
        key: {
          Application: '...',
          ClientId: '...',
          Configuration: '...',
          Environment: '...'
        }
      },
      setToContext: true
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

import test from 'ava'
import sinon from 'sinon'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import {
  StartConfigurationSessionCommand,
  GetLatestConfigurationCommand,
  AppConfigDataClient
} from '@aws-sdk/client-appconfigdata'
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
  'It should set AppConfigData param value to internal storage',
  async (t) => {
    mockClient(AppConfigDataClient)
      .on(StartConfigurationSessionCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        InitialConfigurationToken: 'InitialToken...'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'InitialToken...'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: strToUintArray('{"option":"value"}'),
        NextPollConfigurationToken: 'nextConfigToken'
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.option, 'value')
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigDataClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              ApplicationIdentifier: 'xb0nby2',
              ConfigurationProfileIdentifier: 'ofexqm2',
              EnvironmentIdentifier: '7tp0goq'
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
  }
)

test.serial(
  'It should use previous configuration token on subsequent app config fetch',
  async (t) => {
    mockClient(AppConfigDataClient)
      .on(StartConfigurationSessionCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        InitialConfigurationToken: 'InitialToken...'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'InitialToken...'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: strToUintArray('{"option":"value"}'),
        NextPollConfigurationToken: 'NextConfigToken'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'NextConfigToken'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: strToUintArray('{"option":"newValue"}'),
        NextPollConfigurationToken: 'NextConfigToken'
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      return values.key?.option
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigDataClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              ApplicationIdentifier: '...',
              ConfigurationProfileIdentifier: '...',
              EnvironmentIdentifier: '...'
            }
          }
        })
      )
      .before(middleware)

    const configOne = await handler(event, context)
    const configTwo = await handler(event, context)

    t.is(configOne, 'value')
    t.is(configTwo, 'newValue')
  }
)

test.serial(
  'It should keep previous configuration value if getLatestConfiguration returns null configuration',
  async (t) => {
    mockClient(AppConfigDataClient)
      .on(StartConfigurationSessionCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        InitialConfigurationToken: 'InitialToken...'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'InitialToken...'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: strToUintArray('{"option":"value"}'),
        NextPollConfigurationToken: 'NextConfigToken'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'NextConfigToken'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: null,
        NextPollConfigurationToken: 'NextConfigToken'
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      return values.key?.option
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigDataClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              ApplicationIdentifier: '...',
              ConfigurationProfileIdentifier: '...',
              EnvironmentIdentifier: '...'
            }
          }
        })
      )
      .before(middleware)

    const configOne = await handler(event, context)
    const configTwo = await handler(event, context)

    t.is(configOne, 'value')
    t.is(configTwo, 'value')
  }
)

test.serial(
  'It should set AppConfig param value to internal storage without prefetch',
  async (t) => {
    mockClient(AppConfigDataClient)
      .on(StartConfigurationSessionCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        InitialConfigurationToken: 'InitialToken...'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'InitialToken...'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: strToUintArray('{"option":"value"}'),
        NextPollConfigurationToken: 'nextConfigToken'
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.option, 'value')
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigDataClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              ApplicationIdentifier: '...',
              ConfigurationProfileIdentifier: '...',
              EnvironmentIdentifier: '...'
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
  mockClient(AppConfigDataClient)
    .on(StartConfigurationSessionCommand)
    .resolvesOnce({
      ContentType: 'application/json',
      InitialConfigurationToken: 'InitialToken...'
    })
    .on(GetLatestConfigurationCommand, {
      ConfigurationToken: 'InitialToken...'
    })
    .resolvesOnce({
      ContentType: 'application/json',
      Configuration: strToUintArray('{"option":"value"}'),
      NextPollConfigurationToken: 'NextConfigToken'
    })

  const middleware = async (request) => {
    t.is(request.context.key?.option, 'value')
  }

  const handler = middy(() => {})
    .use(
      appConfig({
        AwsClient: AppConfigDataClient,
        cacheExpiry: 0,
        fetchData: {
          key: {
            ApplicationIdentifier: '...',
            ConfigurationProfileIdentifier: '...',
            EnvironmentIdentifier: '...'
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
    const mockService = mockClient(AppConfigDataClient)
    mockService
      .on(StartConfigurationSessionCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        InitialConfigurationToken: 'InitialToken...'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'InitialToken...'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: strToUintArray('{"option":"value"}'),
        NextPollConfigurationToken: 'NextConfigToken'
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.option, 'value')
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigDataClient,
          cacheExpiry: -1,
          fetchData: {
            key: {
              ApplicationIdentifier: '...',
              ConfigurationProfileIdentifier: '...',
              EnvironmentIdentifier: '...'
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(mockService.send.callCount, 2)
  }
)

test.serial(
  'It should not call aws-sdk again if parameter is cached',
  async (t) => {
    const mockService = mockClient(AppConfigDataClient)
    mockService
      .on(StartConfigurationSessionCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        InitialConfigurationToken: 'InitialToken...'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'InitialToken...'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: strToUintArray('{"option":"value"}'),
        NextPollConfigurationToken: 'NextConfigToken'
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.is(values.key?.option, 'value')
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigDataClient,
          cacheExpiry: 1000,
          fetchData: {
            key: {
              ApplicationIdentifier: '...',
              ConfigurationProfileIdentifier: '...',
              EnvironmentIdentifier: '...'
            }
          }
        })
      )
      .before(middleware)

    await handler(event, context)
    await handler(event, context)

    t.is(mockService.send.callCount, 2)
  }
)

test.serial(
  'It should call aws-sdk if cache enabled but cached param has expired',
  async (t) => {
    const mockService = mockClient(AppConfigDataClient)
    mockService
      .on(StartConfigurationSessionCommand)
      .resolvesOnce({
        ContentType: 'application/json',
        InitialConfigurationToken: 'InitialToken...'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'InitialToken...'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: strToUintArray('{"option":"value"}'),
        NextPollConfigurationToken: 'NextConfigToken'
      })
      .on(GetLatestConfigurationCommand, {
        ConfigurationToken: 'NextConfigToken'
      })
      .resolvesOnce({
        ContentType: 'application/json',
        Configuration: strToUintArray('{"option":"newValue"}'),
        NextPollConfigurationToken: 'NextConfigToken'
      })

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      return values.key?.option
    }

    const handler = middy(() => {})
      .use(
        appConfig({
          AwsClient: AppConfigDataClient,
          cacheExpiry: 0,
          fetchData: {
            key: {
              ApplicationIdentifier: '...',
              ConfigurationProfileIdentifier: '...',
              EnvironmentIdentifier: '...'
            }
          }
        })
      )
      .before(middleware)

    const configOne = await handler(event, context)
    const configTwo = await handler(event, context)

    t.is(configOne, 'value')
    t.is(configTwo, 'newValue')

    t.is(mockService.send.callCount, 3)
    t.true(
      mockService.send.firstCall.firstArg instanceof
        StartConfigurationSessionCommand
    )
    t.true(
      mockService.send.secondCall.firstArg instanceof
        GetLatestConfigurationCommand
    )
    t.true(
      mockService.send.thirdCall.firstArg instanceof
        GetLatestConfigurationCommand
    )
  }
)

test.serial('It should catch if an error is returned from fetch', async (t) => {
  const mockService = mockClient(AppConfigDataClient)
  mockService
    .on(StartConfigurationSessionCommand)
    .resolvesOnce({
      ContentType: 'application/json',
      InitialConfigurationToken: 'InitialToken...'
    })
    .on(GetLatestConfigurationCommand, {
      ConfigurationToken: 'InitialToken...'
    })
    .rejects('timeout')

  const handler = middy(() => {}).use(
    appConfig({
      AwsClient: AppConfigDataClient,
      cacheExpiry: 0,
      fetchData: {
        key: {
          ApplicationIdentifier: '...',
          ConfigurationProfileIdentifier: '...',
          EnvironmentIdentifier: '...'
        }
      },
      setToContext: true
    })
  )

  try {
    await handler(event, context)
  } catch (e) {
    t.is(mockService.send.callCount, 2)
    t.is(e.message, 'Failed to resolve internal values')
    t.deepEqual(e.cause, [new Error('timeout')])
  }
})

test.todo('Should not parse configuration is mime type is not application/json')
test.todo(
  'Should catch error if an error is returned from StartConfigurationSessionCommand'
)

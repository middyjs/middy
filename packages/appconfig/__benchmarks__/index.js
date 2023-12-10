import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import {
  StartConfigurationSessionCommand,
  GetLatestConfigurationCommand,
  AppConfigDataClient
} from '@aws-sdk/client-appconfigdata'

const bench = new Bench({ time: 1_000 })

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options = {}) => {
  const strToUintArray = (str) =>
    Uint8Array.from(str.split('').map((x) => x.charCodeAt()))

  mockClient(AppConfigDataClient)
    .on(StartConfigurationSessionCommand, {
      ApplicationIdentifier: '...',
      ConfigurationProfileIdentifier: '...',
      EnvironmentIdentifier: '...'
    })
    .resolves({
      ContentType: 'application/json',
      InitialConfigurationToken: 'InitialToken...'
    })
    .on(GetLatestConfigurationCommand, {
      ConfigurationToken: 'InitialToken...'
    })
    .resolves({
      ContentType: 'application/json',
      Configuration: strToUintArray('{"option":"value"}'),
      NextPollConfigurationToken: 'nextConfigToken'
    })
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: AppConfigDataClient
    })
  )
}

const coldHandler = setupHandler({ cacheExpiry: 0 })
const warmHandler = setupHandler()

const event = {}
await bench
  .add('without cache', async () => {
    try {
      await coldHandler(event, context)
    } catch (e) {}
  })
  .add('with cache', async () => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })

  .run()

console.table(bench.table())

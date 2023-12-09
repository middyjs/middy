import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import {
  ServiceDiscoveryClient,
  DiscoverInstancesCommand
} from '@aws-sdk/client-servicediscovery'

const bench = new Bench({ time: 1_000 })

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options = {}) => {
  mockClient(ServiceDiscoveryClient)
    .on(DiscoverInstancesCommand)
    .resolves({
      Instances: [
        {
          Attributes: {
            AWS_INSTANCE_IPV4: '172.2.1.3',
            AWS_INSTANCE_PORT: '808'
          },
          HealthStatus: 'UNKNOWN',
          InstanceId: 'myservice-53',
          NamespaceName: 'example.com',
          ServiceName: 'myservice'
        }
      ]
    })
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: ServiceDiscoveryClient
    })
  )
}

const coldHandler = setupHandler({ cacheExpiry: 0 })
const warmHandler = setupHandler()

await bench
  .add('without cache', async (event = {}) => {
    try {
      await coldHandler(event, context)
    } catch (e) {}
  })
  .add('with cache', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })

  .run()

console.table(bench.table())

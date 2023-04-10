import test from 'ava'
import sinon from 'sinon'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../util/index.js'
import {
  ServiceDiscoveryClient,
  DiscoverInstancesCommand
} from '@aws-sdk/client-servicediscovery'
import serviceDiscovery from '../index.js'

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

test.serial('It should set instances to internal storage', async (t) => {
  mockClient(ServiceDiscoveryClient)
    .on(DiscoverInstancesCommand)
    .resolvesOnce({
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

  const handler = middy(() => {})

  const middleware = async (request) => {
    const values = await getInternal(true, request)
    t.deepEqual(values.ec2, [
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
    ])
  }

  handler
    .use(
      serviceDiscovery({
        AwsClient: ServiceDiscoveryClient,
        cacheExpiry: 0,
        fetchData: {
          ec2: {
            NamespaceName: 'example.com',
            ServiceName: 'example'
          }
        }
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should set STS secret to internal storage without prefetch',
  async (t) => {
    mockClient(ServiceDiscoveryClient)
      .on(DiscoverInstancesCommand)
      .resolvesOnce({
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

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.deepEqual(values.ec2, [
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
      ])
    }

    handler
      .use(
        serviceDiscovery({
          AwsClient: ServiceDiscoveryClient,
          cacheExpiry: 0,
          fetchData: {
            ec2: {
              NamespaceName: 'example.com',
              ServiceName: 'example'
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
  mockClient(ServiceDiscoveryClient)
    .on(DiscoverInstancesCommand)
    .resolvesOnce({
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

  const handler = middy(() => {})

  const middleware = async (request) => {
    t.deepEqual(request.context.ec2, [
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
    ])
  }

  handler
    .use(
      serviceDiscovery({
        AwsClient: ServiceDiscoveryClient,
        cacheExpiry: 0,
        fetchData: {
          ec2: {
            NamespaceName: 'example.com',
            ServiceName: 'example'
          }
        },
        setToContext: true
      })
    )
    .before(middleware)

  await handler(event, context)
})

test.serial(
  'It should not call aws-sdk again if parameter is cached',
  async (t) => {
    const mockService = mockClient(ServiceDiscoveryClient)
      .on(DiscoverInstancesCommand)
      .resolvesOnce({
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
    const sendStub = mockService.send

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.deepEqual(values.ec2, [
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
      ])
    }

    handler
      .use(
        serviceDiscovery({
          AwsClient: ServiceDiscoveryClient,
          cacheExpiry: -1,
          fetchData: {
            ec2: {
              NamespaceName: 'example.com',
              ServiceName: 'example'
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
    const mockService = mockClient(ServiceDiscoveryClient)
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
    const sendStub = mockService.send

    const handler = middy(() => {})

    const middleware = async (request) => {
      const values = await getInternal(true, request)
      t.deepEqual(values.ec2, [
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
      ])
    }

    handler
      .use(
        serviceDiscovery({
          AwsClient: ServiceDiscoveryClient,
          cacheExpiry: 0,
          fetchData: {
            ec2: {
              NamespaceName: 'example.com',
              ServiceName: 'example'
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
  const mockService = mockClient(ServiceDiscoveryClient)
    .on(DiscoverInstancesCommand)
    .rejects('timeout')
  const sendStub = mockService.send

  const handler = middy(() => {}).use(
    serviceDiscovery({
      AwsClient: ServiceDiscoveryClient,
      cacheExpiry: 0,
      fetchData: {
        ec2: {
          NamespaceName: 'example.com',
          ServiceName: 'example'
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
    t.deepEqual(e.cause.data, [new Error('timeout')])
  }
})

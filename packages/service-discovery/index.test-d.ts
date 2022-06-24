import { expectType } from 'tsd'
import middy from '@middy/core'
import ServiceDiscovery from 'aws-sdk/clients/servicediscovery'
import { captureAWSClient } from 'aws-xray-sdk'
import serviceDiscovery from '.'

// use with default options
let middleware = serviceDiscovery()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = serviceDiscovery({
  AwsClient: ServiceDiscovery,
  awsClientOptions: {},
  awsClientCapture: captureAWSClient,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj>(middleware)

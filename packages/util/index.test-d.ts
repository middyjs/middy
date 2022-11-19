import middy from '@middy/core'
import { expectType } from 'tsd'
import { SSMClient } from '@aws-sdk/client-ssm'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as util from '.'

const sampleRequest: middy.Request<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error
> = {
  event: {
    body: '',
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/foo/bar',
    pathParameters: {},
    queryStringParameters: {},
    multiValueQueryStringParameters: {},
    stageVariables: {},
    requestContext: {
      accountId: 'foo',
      apiId: 'bar',
      authorizer: {},
      protocol: 'https',
      httpMethod: 'GET',
      identity: {
        accessKey: '',
        accountId: '',
        apiKey: '',
        apiKeyId: '',
        caller: '',
        clientCert: null,
        cognitoAuthenticationProvider: '',
        cognitoAuthenticationType: '',
        cognitoIdentityId: '',
        cognitoIdentityPoolId: '',
        principalOrgId: '',
        sourceIp: '',
        user: '',
        userAgent: '',
        userArn: ''
      },
      requestId: '',
      requestTimeEpoch: 1234,
      resourceId: '',
      resourcePath: '',
      path: '/foo/bar',
      stage: 'dev'
    },
    resource: ''
  },
  context: {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'myfunction',
    functionVersion: '1.0',
    invokedFunctionArn:
      'arn:aws:lambda:us-west-2:123456789012:function:my-function',
    memoryLimitInMB: '17',
    awsRequestId: 'abc22',
    logGroupName: 'my-function-lg',
    logStreamName: 'my-function-ls',
    getRemainingTimeInMillis: () => 22222222,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  },
  response: null,
  error: null,
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
    })
  }
}

const prefetchClient = util.createPrefetchClient<SSMClient, {}>({
  AwsClient: SSMClient
})
expectType<SSMClient>(prefetchClient)

const client = util.createClient<SSMClient, {}>(
  { AwsClient: SSMClient },
  sampleRequest
)
expectType<Promise<SSMClient>>(client)

const canPrefetch = util.canPrefetch<SSMClient, {}>({ AwsClient: SSMClient })
expectType<boolean>(canPrefetch)

async function testGetInternal (): Promise<any> {
  const values = await util.getInternal(true, sampleRequest)
  expectType<any>(values) // this will actually be an object
}
expectType<Promise<any>>(testGetInternal())

async function testGetInternalField (): Promise<any> {
  const value = await util.getInternal('number', sampleRequest)
  expectType<any>(value) // this will actually be a number
}
expectType<Promise<any>>(testGetInternalField())

const sanitizedKey = util.sanitizeKey('aaaaa')
expectType<string>(sanitizedKey)

const { value, expiry } = util.processCache<SSMClient, {}>(
  {},
  (request) => request,
  sampleRequest
)
expectType<any>(value)
expectType<number>(expiry)

const cachedValue = util.getCache('someKey')
expectType<any>(cachedValue)

util.clearCache(['someKey', 'someOtherKey'])
util.clearCache('someKey')
util.clearCache(null)
util.clearCache()

const parsed = util.jsonSafeParse('{"foo":"bar"}', (k, v) => v)
expectType<any>(parsed)

const normalizedResponse = util.normalizeHttpResponse({}, {})
expectType<any>(normalizedResponse)

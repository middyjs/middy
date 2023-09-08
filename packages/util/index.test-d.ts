import middy from '@middy/core'
import { expectType } from 'tsd'
import { SSMClient } from '@aws-sdk/client-ssm'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from 'aws-lambda'
import * as util from '.'

type TInternal = {
  boolean: true,
  number: 1,
  string: 'string',
  array: [],
  object: {
    key: 'value'
  },
  promise: Promise<string>,
  promiseObject: Promise<{
    key: 'value'
  }>
}

const sampleRequest: middy.Request<
APIGatewayProxyEvent,
APIGatewayProxyResult,
Error,
LambdaContext,
TInternal
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

// getInternal single field
async function testGetInternalField () {
  return await util.getInternal('number', sampleRequest)
}
expectType<Promise<{ number: 1 }>>(testGetInternalField())

// getInternal multiple fields
async function testGetInternalFields () {
  return await util.getInternal(['number', 'boolean'], sampleRequest)
}
expectType<Promise<{ number: 1, boolean: true }>>(testGetInternalFields())


// getInternal all fields (true)
async function testGetAllInternal () {
  return await util.getInternal(true, sampleRequest)
}
expectType<Promise<TInternal>>(testGetAllInternal())

// getInternal with mapping object
async function testGeAndRemapInternal () {
  return await util.getInternal({
    a: 'number',
    b: 'string',
    c: 'boolean'
  }, sampleRequest)
}
expectType<Promise<{ a: 1, b: 'string', c: true }>>(testGeAndRemapInternal())

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

// should be able to use HttpError as a proper class
const err = util.createError(500, 'An unexpected error occurred')
expectType<util.HttpError>(err)
// err instanceof util.HttpError // would throw a type error if not a class

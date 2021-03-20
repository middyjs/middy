const https = require('https')
const parseUrl = require('url').parse
const { PassThrough, pipeline} = require('stream')
const eventEmitter = require('events')

const {
  canPrefetch,
  createPrefetchClient,
  createClient,
} = require('@middy/util')

const S3 = require('aws-sdk/clients/s3.js') // v2
// const { S3 } = require('@aws-sdk/client-s3') // v3

const defaults = {
  AwsClient: S3, // Allow for XRay
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  disablePrefetch: false,
  //setToEnv: false,
  setToContext: false // if true return full object contents
}

// Names: s3-object-response
const s3ObjectResponseMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  let client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
  }

  const s3ObjectResponseMiddlewareBefore = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    const {inputS3Url, outputRoute, outputToken} = request.event.getObjectContext

    const s3ObjectResponse = {
      outputRoute,
      outputToken
    }

    const parsedInputS3Url = parseUrl(inputS3Url)
    const fetchOptions = {
      method: 'GET',
      host: parsedInputS3Url.hostname,
      port: parsedInputS3Url.port,
      path: parsedInputS3Url.path,
    }

    if (options.setToContext) {
      request.context.s3Object = await fetchPromise(fetchOptions)
    } else {
      s3ObjectResponse.readStream = fetchStream(fetchOptions)
    }
    request.internal.s3ObjectResponse = s3ObjectResponse
  }

  const s3ObjectResponseMiddlewareAfter = async(request) => {
    // Docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#writeGetObjectResponse-property

    const {readStream, outputRoute, outputToken} = request.internal.s3ObjectResponse

    let body = request.response.body

    if ( isWritableStream(request.response.body)) {
      body = pipeline(readStream, body)
    }
    delete request.response.body

    await client.writeGetObjectResponse({
      ...request.response,
      RequestRoute: outputRoute,
      RequestToken: outputToken,
      Body: body
    })

    return {
      statusCode: 200
    }
  }

  return {
    before: s3ObjectResponseMiddlewareBefore,
    after: s3ObjectResponseMiddlewareAfter
  }
}

const fetchStream = (options) => {
  const s3ObjectRequest = https.request(options)
  const readStream = new PassThrough()
  s3ObjectRequest.on('data', chunk => {
    readStream.push(chunk)
  })
  return readStream
}

const fetchPromise = (options) => {
  const stream = fetchStream(options)
  return new Promise((resolve, reject) => {
    let data = ''
    stream.on('data', chunk => data += chunk)
    stream.on('end', () => resolve(data))
    stream.on('error', error => reject(error))
  })
}

const isWritableStream = (body) => {
  return body instanceof eventEmitter && typeof body.write === 'function' && typeof body.end === 'function'
}

module.exports = s3ObjectResponseMiddleware

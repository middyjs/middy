const https = require('https')
const { URL } = require('url')

const {
  canPrefetch,
  createPrefetchClient,
  createClient
} = require('@middy/util')

const S3 = require('aws-sdk/clients/s3.js') // v2
// const { S3 } = require('@aws-sdk/client-s3') // v3

const defaults = {
  AwsClient: S3, // Allow for XRay
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  disablePrefetch: false,
  bodyType: undefined
}

const s3ObjectResponseMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  if (!options.bodyType) throw new Error(`bodyType is required.`)

  let client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
  }

  const s3ObjectResponseMiddlewareBefore = async (request) => {
    const { inputS3Url, outputRoute, outputToken } = request.event.getObjectContext

    request.internal.s3ObjectResponse = {
      RequestRoute: outputRoute,
      RequestToken: outputToken,
    }

    const parsedInputS3Url = new URL(inputS3Url)
    const fetchOptions = {
      method: 'GET',
      host: parsedInputS3Url.hostname,
      path: parsedInputS3Url.pathname
    }

    let s3Object
    if (options.bodyType === 'stream') {
      s3Object = fetchStream(fetchOptions)
    } else if (options.bodyType === 'promise') {
      s3Object = fetchPromise(fetchOptions)
    } else {
      throw new Error('bodyType value unsupported.')
    }
    request.context.s3Object = s3Object

  }

  const s3ObjectResponseMiddlewareAfter = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    return client.writeGetObjectResponse({
      ...request.response,
      ...request.internal.s3ObjectResponse,
      Body: request.response.Body ?? request.response.body
    }).promise()
      .then(() => ({statusCode: 200}))
  }

  return {
    before: s3ObjectResponseMiddlewareBefore,
    after: s3ObjectResponseMiddlewareAfter
  }
}

const fetchStream = (options) => {
  return https.request(options)
}

const fetchPromise = (options) => {
  return new Promise((resolve, reject) => {
    let data = ''
    const stream = fetchStream(options)
    stream.on('data', chunk => { data += chunk })
    stream.on('end', () => resolve(data))
    stream.on('error', error => reject(error))
  })
}

module.exports = s3ObjectResponseMiddleware

import __https from 'https'
import { URL } from 'url'

import {
  canPrefetch,
  createPrefetchClient,
  createClient
} from '@middy/util'

import S3 from 'aws-sdk/clients/s3.js' // v2
// import { S3 } from '@aws-sdk/client-s3' // v3

const defaults = {
  AwsClient: S3,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  httpsCapture: undefined,
  disablePrefetch: false,
  bodyType: undefined,

  // For mocking out only, rewire doesn't support ES Modules :(
  __https
}

let https = __https
const s3ObjectResponseMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  if (!['stream', 'promise'].includes(options.bodyType)) {
    throw new Error('bodyType is invalid.')
  }

  if (options.httpsCapture) {
    https = options.httpsCapture(options.__https)
  }

  let client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
  }

  const s3ObjectResponseMiddlewareBefore = async (request) => {
    const {
      inputS3Url,
      outputRoute,
      outputToken
    } = request.event.getObjectContext

    request.internal.s3ObjectResponse = {
      RequestRoute: outputRoute,
      RequestToken: outputToken
    }

    const parsedInputS3Url = new URL(inputS3Url)
    const fetchOptions = {
      method: 'GET',
      host: parsedInputS3Url.hostname,
      path: parsedInputS3Url.pathname
    }

    request.context.s3Object = fetchType(options.bodyType, fetchOptions)
  }

  const s3ObjectResponseMiddlewareAfter = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    request.response.Body ??= request.response.body
    delete request.response.body

    return client
      .writeGetObjectResponse({
        ...request.response,
        ...request.internal.s3ObjectResponse
      })
      .promise()
      .then(() => ({ statusCode: 200 })) // TODO test if needed
  }

  return {
    before: s3ObjectResponseMiddlewareBefore,
    after: s3ObjectResponseMiddlewareAfter
  }
}

const fetchType = (type, fetchOptions) => {
  if (type === 'stream') {
    return fetchStream(fetchOptions)
  } else if (type === 'promise') {
    return fetchPromise(fetchOptions)
  }
  return null
}

const fetchStream = (fetchOptions) => {
  return https.request(fetchOptions)
}

const fetchPromise = (fetchOptions) => {
  return new Promise((resolve, reject) => {
    let data = ''
    const stream = fetchStream(fetchOptions)
    stream.on('data', (chunk) => {
      data += chunk
    })
    stream.on('end', () => resolve(data))
    stream.on('error', (error) => reject(error))
  })
}

export default s3ObjectResponseMiddleware

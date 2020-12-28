
//const httpError = require('http-error')

import middy from '../packages/core/index.js'
import middyProfiler from '../packages/core/profiler.js'

import httpServerTiming from '../packages/http-server-timing/index.js'
import eventLogger from '../packages/input-output-logger/index.js'
import errorLogger from '../packages/error-logger/index.js'
import doNotWaitForEmptyEventLoop from '../packages/do-not-wait-for-empty-event-loop/index.js'

import httpHeaderNormalizer from '../packages/http-header-normalizer/index.js'
import httpEventNormalizer from '../packages/http-event-normalizer/index.js'
import httpJsonBodyParser from '../packages/http-json-body-parser/index.js'
import httpUrlencodeBodyParser from '../packages/http-urlencode-body-parser/index.js'
import httpUrlencodePathParametersParser from '../packages/http-urlencode-path-parser/index.js'
import httpContentNegotiation from '../packages/http-content-negotiation/index.js'
import validator from '../packages/validator/index.js'

import httpCors from '../packages/http-cors/index.js'
import httpSecurityHeaders from '../packages/http-security-headers/index.js'

import fetchSts from '../packages/sts/index.js'
import fetchSsm from '../packages/ssm/index.js'
import fetchSecretsManager from '../packages/secrets-manager/index.js'
import fetchRdsSigner from '../packages/rds-signer/index.js'

import httpErrorHandler from '../packages/http-error-handler/index.js'

const handler = async (event, context) => {
  //throw { statusCode: 500, message: 'test' }

  return {
    statusCode: 200,
    body: {
      data: {
        success: true,
        timestamp: new Date().toISOString()
      }
    }
  }
}

const inputSchema = {
  type:"object"
}

const outputSchema = {
  type:"object"
}

const runExport = middy(handler, middyProfiler())
  .use(httpServerTiming())
  .use(eventLogger())
  .use(errorLogger())
  .use(doNotWaitForEmptyEventLoop())

  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(httpUrlencodePathParametersParser())
  .use(httpUrlencodeBodyParser())
  .use(httpJsonBodyParser())

  .use(httpCors())
  .use(httpSecurityHeaders())

  .use(
    httpContentNegotiation({
      availableLanguages: ['en-CA', 'fr-CA']
    })
  )

  .use(validator({ inputSchema, outputSchema }))


  .use(httpErrorHandler())

const event = {}
const context = {}
const callback = (err, res) => {
  console.log(res)
}

runExport(event, context, callback)

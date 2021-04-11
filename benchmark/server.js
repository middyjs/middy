'use strict'

process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = 1

const endpoints = {
  '/': require('./examples/baseline'),
  '/api-gateway': require('./examples/api-gateway'),
  '/database': require('./examples/database'),
  '/logging': require('./examples/logging'),
  '/s3-event': require('./examples/s3-event'),
  // '/s3-get-promise': require('./examples/s3-get-promise'),
  // '/s3-get-stream': require('./examples/s3-get-stream'),
  // '/secrets': require('./examples/secrets'),
  // '/sns-event': require('./examples/sns-event'),
  '/sqs-event': require('./examples/sqs-event')
}

const requestListener = async (req, res) => {
  await endpoints[req.url].handler(
    endpoints[req.url].event,
    endpoints[req.url].context
  )
  res.end()
}

require('http').createServer(requestListener).listen(3000)

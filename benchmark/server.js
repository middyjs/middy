'use strict'

process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = 1

const endpoints = {
  '/': require('./examples/baseline'),
  '/api-gateway': require('./examples/api-gateway'),
  //'/dynamodb-event': require('./examples/dynamodb-event'),
  //'/kinesis-firehose-event': require('./examples/kinesis-firehose-event'),
  //'/kinesis-stream-event': require('./examples/kinesis-stream-event'),
  '/logging': require('./examples/logging'),
  '/rds-connection': require('./examples/rds-connection'),
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

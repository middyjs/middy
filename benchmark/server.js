'use strict'

const endpoints = {
  '/': require('./examples/baseline'),
  '/s3-event': require('./examples/s3-event'),
  '/sqs-event': require('./examples/sqs-event')
}

const requestListener = async (req, res) => {
  await endpoints[req.url].handler(endpoints[req.url].event, endpoints[req.url].context)
  res.end()
}

require('http').createServer(requestListener).listen(3000)

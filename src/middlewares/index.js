module.exports = {
  cache: require('./cache'),
  cors: require('./cors'),
  doNotWaitForEmptyEventLoop: require('./doNotWaitForEmptyEventLoop'),
  httpContentNegotiation: require('./httpContentNegotiation'),
  httpErrorHandler: require('./httpErrorHandler'),
  httpEventNormalizer: require('./httpEventNormalizer'),
  httpHeaderNormalizer: require('./httpHeaderNormalizer'),
  jsonBodyParser: require('./jsonBodyParser'),
  partialResponse: require('./partialResponse'),
  s3KeyNormalizer: require('./s3KeyNormalizer'),
  ssm: require('./ssm'),
  urlEncodeBodyParser: require('./urlEncodeBodyParser'),
  validator: require('./validator'),
  warmup: require('./warmup')
}

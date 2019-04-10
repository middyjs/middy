module.exports = {
  cache: require('./cache'),
  cors: require('./cors'),
  doNotWaitForEmptyEventLoop: require('./doNotWaitForEmptyEventLoop'),
  httpContentNegotiation: require('./httpContentNegotiation'),
  httpErrorHandler: require('./httpErrorHandler'),
  httpEventNormalizer: require('./httpEventNormalizer'),
  httpHeaderNormalizer: require('./httpHeaderNormalizer'),
  httpMultipartBodyParser: require('./httpMultipartBodyParser'),
  httpPartialResponse: require('./httpPartialResponse'),
  httpSecurityHeaders: require('./httpSecurityHeaders'),
  jsonBodyParser: require('./jsonBodyParser'),
  s3KeyNormalizer: require('./s3KeyNormalizer'),
  secretsManager: require('./secretsManager'),
  ssm: require('./ssm'),
  urlEncodeBodyParser: require('./urlEncodeBodyParser'),
  validator: require('./validator'),
  warmup: require('./warmup')
}

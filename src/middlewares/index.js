module.exports = {
  cache: require('./cache'),
  cors: require('./cors'),
  doNotWaitForEmptyEventLoop: require('./doNotWaitForEmptyEventLoop'),
  httpErrorHandler: require('./httpErrorHandler'),
  httpHeaderNormalizer: require('./httpHeaderNormalizer'),
  jsonBodyParser: require('./jsonBodyParser'),
  s3KeyNormalizer: require('./s3KeyNormalizer'),
  urlEncodeBodyParser: require('./urlEncodeBodyParser'),
  validator: require('./validator'),
  warmup: require('./warmup')
}

module.exports = {
  cors: require('./cors'),
  doNotWaitForEmptyEventLoop: require('./doNotWaitForEmptyEventLoop'),
  httpErrorHandler: require('./httpErrorHandler'),
  jsonBodyParser: require('./jsonBodyParser'),
  s3KeyNormalizer: require('./s3KeyNormalizer'),
  urlencodeBodyParser: require('./urlencodeBodyParser'),
  validator: require('./validator')
}

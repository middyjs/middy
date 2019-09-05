module.exports = () => ({
  before: (handler, next) => {
    const { event } = handler

    if (Object.prototype.hasOwnProperty.call(event, 'httpMethod')) {
      event.queryStringParameters = event.queryStringParameters || {}
      event.multiValueQueryStringParameters = event.multiValueQueryStringParameters || {}
      event.pathParameters = event.pathParameters || {}
    }

    return next()
  }
})

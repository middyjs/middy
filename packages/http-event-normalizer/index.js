module.exports = () => ({
  before: (handler, next) => {
    const { event } = handler

    if (event.hasOwnProperty('httpMethod')) {
      event.queryStringParameters = event.queryStringParameters || {}
      event.pathParameters = event.pathParameters || {}
    }

    return next()
  }
})

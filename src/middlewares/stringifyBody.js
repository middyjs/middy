const stringifyBody = () => ({
  after: (handler, next) => {
    const response = handler.response
    if (!response.hasOwnProperty('body') || typeof (response.body) === 'string') {
      return next()
    }

    response.body = JSON.stringify(response.body)

    next()
  }
})

module.exports = stringifyBody

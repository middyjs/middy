const { promisify } = require('util')

function invoke (handler, event = {}, context = {}) {
  return promisify(handler)(event, context)
}

module.exports = {
  invoke
}

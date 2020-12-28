const promisify = require('util').promisify

function invoke (handler, event = {}, context = {}) {
  return promisify(handler)(event, context)
}

module.exports = {
  invoke
}

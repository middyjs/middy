const { promisify } = require('util') || require('es6-promisify')

function invoke (handler, event = {}, context = {}) {
  return promisify(handler)(event, context)
}

module.exports = {
  invoke
}

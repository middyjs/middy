let { promisify } = require('util')
if (typeof promisify === 'undefined') {
  promisify = require('es6-promisify')
}

function invoke (handler, event = {}, context = {}) {
  return promisify(handler)(event, context)
}

module.exports = {
  invoke
}

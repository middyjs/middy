const util = require('util')
const promisify = util.promisify || require('es6-promisify').promisify

function invoke (handler, event = {}, context = {}) {
  return promisify(handler)(event, context)
}

module.exports = {
  invoke
}

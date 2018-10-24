const functionShield = require('@puresec/function-shield')
const merge = require('deepmerge')

module.exports = (opts = {}) => ({
  before: (handler, next) => {
    const defaults = {
      policy: {
        outbound_connectivity: 'block',
        read_write_tmp: 'block',
        create_child_process: 'block',
        read_handler: 'block'
      },
      disable_analytics: false,
      token: process.env.FUNCTION_SHIELD_TOKEN || handler.context.FUNCTION_SHIELD_TOKEN
    }
    const options = merge(defaults, opts)

    functionShield.configure(options)

    next()
  }
})

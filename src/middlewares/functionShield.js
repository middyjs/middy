const functionShield = require('@puresec/function-shield')

module.exports = (opts) => ({
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
    const options = Object.assign({}, defaults, {
      policy: Object.assign({}, defaults.policy, opts.policy)
    })

    functionShield.configure(options)

    next()
  }
})

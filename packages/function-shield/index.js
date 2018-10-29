let coldStart = true
module.exports = (opts = { policy: { } }) => ({
  before: (handler, next) => {
    if (coldStart) {
      const functionShield = require('@puresec/function-shield')
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
      let options = Object.assign({}, defaults, opts)
      options.policy = Object.assign({}, defaults.policy, opts.policy)

      functionShield.configure(options)
      coldStart = false
    }

    next()
  }
})

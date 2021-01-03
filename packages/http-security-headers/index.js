// Code and Defaults heavily based off https://helmetjs.github.io/

const defaults = {
  dnsPrefetchControl: {
    allow: false
  },
  expectCT: {
    enforce: true,
    maxAge: 30
    // reportUri: ''
  },
  frameguard: {
    action: 'deny'
  },
  hidePoweredBy: {
    setTo: null
  },
  hsts: {
    maxAge: 180 * 24 * 60 * 60,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: {
    action: 'noopen'
  },
  noSniff: {
    action: 'nosniff'
  },
  permittedCrossDomainPolicies: {
    policy: 'none' // none, master-only, by-content-type, by-ftp-filename, all
  },
  referrerPolicy: {
    policy: 'no-referrer'
  },
  xssFilter: {
    // reportUri: ''
  }
}

const helmet = {}
const helmetHtmlOnly = {}

// contentSecurityPolicy - N/A - no HTML
// featurePolicy - N/A - no HTML

// crossdomain - N/A - For Adobe products

// https://github.com/helmetjs/dns-Prefetch-control
helmet.dnsPrefetchControl = (headers, options) => {
  headers['X-DNS-Prefetch-Control'] = options.allow ? 'on' : 'off'
  return headers
}

// expectCt - in-progress spec

// https://github.com/helmetjs/frameguard
helmetHtmlOnly.frameguard = (headers, options) => {
  headers['X-Frame-Options'] = options.action.toUpperCase()
  return headers
}

// https://github.com/helmetjs/hide-powered-by
helmet.hidePoweredBy = (headers, options) => {
  if (options.setTo) {
    headers['X-Powered-By'] = options.setTo
  } else {
    Reflect.deleteProperty(headers, 'Server')
    Reflect.deleteProperty(headers, 'X-Powered-By')
  }
  return headers
}

// hpkp - deprecated

// https://github.com/helmetjs/hsts
helmet.hsts = (headers, options) => {
  let header = 'max-age=' + Math.round(options.maxAge)
  if (options.includeSubDomains) {
    header += '; includeSubDomains'
  }
  if (options.preload) {
    header += '; preload'
  }
  headers['Strict-Transport-Security'] = header
  return headers
}

// https://github.com/helmetjs/ienoopen
helmet.ieNoOpen = (headers, options) => {
  headers['X-Download-Options'] = options.action
  return headers
}

// noCache - N/A - separate middleware

// https://github.com/helmetjs/dont-sniff-mimetype
helmet.noSniff = (headers, options) => {
  headers['X-Content-Type-Options'] = options.action
  return headers
}

// https://github.com/helmetjs/referrer-policy
helmet.referrerPolicy = (headers, options) => {
  headers['Referrer-Policy'] = options.policy
  return headers
}

// https://github.com/helmetjs/crossdomain
helmet.permittedCrossDomainPolicies = (headers, options) => {
  headers['X-Permitted-Cross-Domain-Policies'] = options.policy
  return headers
}

// https://github.com/helmetjs/x-xss-protection
helmetHtmlOnly.xssFilter = (headers, options) => {
  let header = '1; mode=block'
  if (options.reportUri) {
    header += '; report=' + options.reportUri
  }
  headers['X-XSS-Protection'] = header
  return headers
}

export default (opts = {}) => {
  opts = Object.assign({}, defaults, opts)

  const httpSecurityHeadersMiddlewareAfter = async (handler) => {
    handler.response = handler.response || { statusCode: 500 } // catch thrown errors, prevent default statusCode
    handler.response.headers = handler.response.headers || {}

    Object.keys(helmet).forEach(key => {
      const options = Object.assign({}, defaults[key], opts[key])
      handler.response.headers = helmet[key](handler.response.headers, options)
    })

    if (handler.response.headers['Content-Type'] && handler.response.headers['Content-Type'].indexOf('text/html') !== -1) {
      Object.keys(helmetHtmlOnly).forEach(key => {
        const options = Object.assign({}, defaults[key], opts[key])
        handler.response.headers = helmetHtmlOnly[key](handler.response.headers, options)
      })
    }
  }

  const httpSecurityHeadersMiddlewareOnError = httpSecurityHeadersMiddlewareAfter

  return {
    after: httpSecurityHeadersMiddlewareAfter,
    onError: httpSecurityHeadersMiddlewareOnError
  }
}

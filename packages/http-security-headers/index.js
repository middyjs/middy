import { normalizeHttpResponse } from '@middy/util'

// Code and Defaults heavily based off https://helmetjs.github.io/

const defaults = {
  contentSecurityPolicy: {
    // Fetch directives
    // 'child-src': '', // fallback default-src
    // 'connect-src': '', // fallback default-src
    'default-src': "'none'",
    // 'font-src':'', // fallback default-src
    // 'frame-src':'', // fallback child-src > default-src
    // 'img-src':'', // fallback default-src
    // 'manifest-src':'', // fallback default-src
    // 'media-src':'', // fallback default-src
    // 'object-src':'', // fallback default-src
    // 'prefetch-src':'', // fallback default-src
    // 'script-src':'', // fallback default-src
    // 'script-src-elem':'', // fallback script-src > default-src
    // 'script-src-attr':'', // fallback script-src > default-src
    // 'style-src':'', // fallback default-src
    // 'style-src-elem':'', // fallback style-src > default-src
    // 'style-src-attr':'', // fallback style-src > default-src
    // 'worker-src':'', // fallback child-src > script-src > default-src
    // Document directives
    'base-uri': "'none'",
    sandbox: '',
    // Navigation directives
    'form-action': "'none'",
    'frame-ancestors': "'none'",
    'navigate-to': "'none'",
    // Reporting directives
    'report-to': 'csp',
    // Other directives
    'require-trusted-types-for': "'script'",
    'trusted-types': "'none'",
    'upgrade-insecure-requests': ''
  },
  contentTypeOptions: {
    action: 'nosniff'
  },
  crossOriginEmbedderPolicy: {
    policy: 'require-corp'
  },
  crossOriginOpenerPolicy: {
    policy: 'same-origin'
  },
  crossOriginResourcePolicy: {
    policy: 'same-origin'
  },
  dnsPrefetchControl: {
    allow: false
  },
  downloadOptions: {
    action: 'noopen'
  },
  frameOptions: {
    action: 'deny'
  },
  originAgentCluster: {},
  permissionsPolicy: {
    // Standard
    accelerometer: '',
    'ambient-light-sensor': '',
    autoplay: '',
    battery: '',
    camera: '',
    'cross-origin-isolated': '',
    'display-capture': '',
    'document-domain': '',
    'encrypted-media': '',
    'execution-while-not-rendered': '',
    'execution-while-out-of-viewport': '',
    fullscreen: '',
    geolocation: '',
    gyroscope: '',
    'keyboard-map': '',
    magnetometer: '',
    microphone: '',
    midi: '',
    'navigation-override': '',
    payment: '',
    'picture-in-picture': '',
    'publickey-credentials-get': '',
    'screen-wake-lock': '',
    'sync-xhr': '',
    usb: '',
    'web-share': '',
    'xr-spatial-tracking': '',
    // Proposed
    'clipboard-read': '',
    'clipboard-write': '',
    gamepad: '',
    'speaker-selection': '',
    // Experimental
    'conversion-measurement': '',
    'focus-without-user-activation': '',
    hid: '',
    'idle-detection': '',
    'interest-cohort': '',
    serial: '',
    'sync-script': '',
    'trust-token-redemption': '',
    'window-placement': '',
    'vertical-scroll': ''
  },
  permittedCrossDomainPolicies: {
    policy: 'none' // none, master-only, by-content-type, by-ftp-filename, all
  },
  poweredBy: {
    server: ''
  },
  referrerPolicy: {
    policy: 'no-referrer'
  },
  reportTo: {
    maxAge: 365 * 24 * 60 * 60,
    default: '',
    includeSubdomains: true,
    csp: '',
    staple: '',
    xss: ''
  },
  strictTransportSecurity: {
    maxAge: 180 * 24 * 60 * 60,
    includeSubDomains: true,
    preload: true
  },
  xssProtection: {
    reportTo: 'xss'
  }
}

const helmet = {}
const helmetHtmlOnly = {}

// *** https://github.com/helmetjs/helmet/tree/main/middlewares *** //
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
helmetHtmlOnly.contentSecurityPolicy = (headers, config) => {
  let header = Object.keys(config)
    .map((policy) => (config[policy] ? `${policy} ${config[policy]}` : ''))
    .filter((str) => str)
    .join('; ')
  if (config.sandbox === '') {
    header += '; sandbox'
  }
  if (config['upgrade-insecure-requests'] === '') {
    header += '; upgrade-insecure-requests'
  }
  headers['Content-Security-Policy'] = header
}
// crossdomain - N/A - for Adobe products
helmetHtmlOnly.crossOriginEmbedderPolicy = (headers, config) => {
  headers['Cross-Origin-Embedder-Policy'] = config.policy
}
helmetHtmlOnly.crossOriginOpenerPolicy = (headers, config) => {
  headers['Cross-Origin-Opener-Policy'] = config.policy
}
helmetHtmlOnly.crossOriginResourcePolicy = (headers, config) => {
  headers['Cross-Origin-Resource-Policy'] = config.policy
}

// DEPRECATED: expectCt
// DEPRECATED: hpkp

// https://www.permissionspolicy.com/
helmetHtmlOnly.permissionsPolicy = (headers, config) => {
  headers['Permissions-Policy'] = Object.keys(config)
    .map(
      (policy) =>
        `${policy}=${config[policy] === '*' ? '*' : '(' + config[policy] + ')'}`
    )
    .join(', ')
}

helmet.originAgentCluster = (headers, config) => {
  headers['Origin-Agent-Cluster'] = '?1'
}

// https://github.com/helmetjs/referrer-policy
helmet.referrerPolicy = (headers, config) => {
  headers['Referrer-Policy'] = config.policy
}

helmetHtmlOnly.reportTo = (headers, config) => {
  headers['Report-To'] = Object.keys(config)
    .map((group) => {
      const includeSubdomains =
        group === 'default'
          ? `, "include_subdomains": ${config.includeSubdomains}`
          : ''
      return config[group] && group !== 'includeSubdomains'
        ? `{ "group": "default", "max_age": ${config.maxAge}, "endpoints": [ { "url": "${config[group]}" } ]${includeSubdomains} }`
        : ''
    })
    .filter((str) => str)
    .join(', ')
}

// https://github.com/helmetjs/hsts
helmet.strictTransportSecurity = (headers, config) => {
  let header = 'max-age=' + Math.round(config.maxAge)
  if (config.includeSubDomains) {
    header += '; includeSubDomains'
  }
  if (config.preload) {
    header += '; preload'
  }
  headers['Strict-Transport-Security'] = header
}

// noCache - N/A - separate middleware

// X-* //
// https://github.com/helmetjs/dont-sniff-mimetype
helmet.contentTypeOptions = (headers, config) => {
  headers['X-Content-Type-Options'] = config.action
}

// https://github.com/helmetjs/dns-Prefetch-control
helmet.dnsPrefetchControl = (headers, config) => {
  headers['X-DNS-Prefetch-Control'] = config.allow ? 'on' : 'off'
}

// https://github.com/helmetjs/ienoopen
helmet.downloadOptions = (headers, config) => {
  headers['X-Download-Options'] = config.action
}

// https://github.com/helmetjs/frameOptions
helmetHtmlOnly.frameOptions = (headers, config) => {
  headers['X-Frame-Options'] = config.action.toUpperCase()
}

// https://github.com/helmetjs/crossdomain
helmet.permittedCrossDomainPolicies = (headers, config) => {
  headers['X-Permitted-Cross-Domain-Policies'] = config.policy
}

// https://github.com/helmetjs/hide-powered-by
helmet.poweredBy = (headers, config) => {
  if (config.server) {
    headers['X-Powered-By'] = config.server
  } else {
    delete headers.Server
    delete headers['X-Powered-By']
  }
}

// https://github.com/helmetjs/x-xss-protection
helmetHtmlOnly.xssProtection = (headers, config) => {
  let header = '1; mode=block'
  if (config.reportTo) {
    header += '; report=' + config.reportTo
  }
  headers['X-XSS-Protection'] = header
}

const httpSecurityHeadersMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const httpSecurityHeadersMiddlewareAfter = async (request) => {
    normalizeHttpResponse(request)

    Object.keys(helmet).forEach((key) => {
      if (!options[key]) return
      const config = { ...defaults[key], ...options[key] }
      helmet[key](request.response.headers, config)
    })
    const contentTypeHeader =
      request.response.headers['Content-Type'] ??
      request.response.headers['content-type']
    if (contentTypeHeader?.includes('text/html')) {
      Object.keys(helmetHtmlOnly).forEach((key) => {
        if (!options[key]) return
        const config = { ...defaults[key], ...options[key] }
        helmetHtmlOnly[key](request.response.headers, config)
      })
    }
  }
  const httpSecurityHeadersMiddlewareOnError = async (request) => {
    if (request.response === undefined) return
    await httpSecurityHeadersMiddlewareAfter(request)
  }
  return {
    after: httpSecurityHeadersMiddlewareAfter,
    onError: httpSecurityHeadersMiddlewareOnError
  }
}
export default httpSecurityHeadersMiddleware

import test from 'ava'
import middy from '../../core/index.js'
import httpSecurityHeaders from '../index.js'

// const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

const createDefaultObjectResponse = () =>
  Object.assign(
    {},
    {
      statusCode: 200,
      body: { firstname: 'john', lastname: 'doe' }
    }
  )

const createHtmlObjectResponse = () =>
  Object.assign(
    {},
    {
      statusCode: 200,
      body: '<html></html>',
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    }
  )

const createHeaderObjectResponse = () =>
  Object.assign(
    {},
    {
      statusCode: 200,
      body: { firstname: 'john', lastname: 'doe' },
      headers: {
        Server: 'AMZN',
        'X-Powered-By': 'MiddyJS'
      }
    }
  )

const createArrayResponse = () => [{ firstname: 'john', lastname: 'doe' }]

test('It should return default security headers', async (t) => {
  const handler = middy((event, context) => createDefaultObjectResponse())

  handler.use(httpSecurityHeaders())

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.is(response.statusCode, 200)

  t.is(response.headers['Origin-Agent-Cluster'], '?1')
  t.is(response.headers['Referrer-Policy'], 'no-referrer')
  t.is(response.headers.Server, undefined)
  t.is(response.headers['Strict-Transport-Security'], 'max-age=15552000; includeSubDomains; preload')
  t.is(response.headers['X-Content-Type-Options'], 'nosniff')
  t.is(response.headers['X-DNS-Prefetch-Control'], 'off')
  t.is(response.headers['X-Download-Options'], 'noopen')
  t.is(response.headers['X-Permitted-Cross-Domain-Policies'], 'none')
  t.is(response.headers['X-Powered-By'], undefined)
  t.is(response.headers['X-Frame-Options'], undefined)
  t.is(response.headers['X-XSS-Protection'], undefined)
})

test('It should return default security headers when HTML', async (t) => {
  const handler = middy((event, context) => createHtmlObjectResponse())

  handler.use(httpSecurityHeaders())

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.is(response.headers['Content-Security-Policy'], 'default-src \'none\'; base-uri \'none\'; form-action \'none\'; frame-ancestors \'none\'; navigate-to \'none\'; report-to csp; require-trusted-types-for \'script\'; trusted-types \'none\'; sandbox; upgrade-insecure-requests')
  t.is(response.headers['Cross-Origin-Embedder-Policy'], 'require-corp')
  t.is(response.headers['Cross-Origin-Opener-Policy'], 'same-origin')
  t.is(response.headers['Cross-Origin-Resource-Policy'], 'same-origin')
  t.is(response.headers['Origin-Agent-Cluster'], '?1')
  t.is(response.headers['Permissions-Policy'], 'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=(), clipboard-read=(), clipboard-write=(), gamepad=(), speaker-selection=(), conversion-measurement=(), focus-without-user-activation=(), hid=(), idle-detection=(), interest-cohort=(), serial=(), sync-script=(), trust-token-redemption=(), window-placement=(), vertical-scroll=()')
  t.is(response.headers['Referrer-Policy'], 'no-referrer')
  t.is(response.headers.Server, undefined)
  t.is(response.headers['Strict-Transport-Security'], 'max-age=15552000; includeSubDomains; preload')
  t.is(response.headers['X-Content-Type-Options'], 'nosniff')
  t.is(response.headers['X-DNS-Prefetch-Control'], 'off')
  t.is(response.headers['X-Download-Options'], 'noopen')
  t.is(response.headers['X-Permitted-Cross-Domain-Policies'], 'none')
  t.is(response.headers['X-Powered-By'], undefined)
  t.is(response.headers['X-Frame-Options'], 'DENY')
  t.is(response.headers['X-XSS-Protection'], '1; mode=block; report=xss')
})

test('It should modify default security headers', async (t) => {
  const handler = middy((event, context) => createHeaderObjectResponse())

  handler.use(httpSecurityHeaders())

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.is(response.statusCode, 200)
  t.is(response.headers.Server, undefined)
  t.is(response.headers['X-Powered-By'], undefined)
})

test('It should modify default security headers with config set', async (t) => {
  const handler = middy((event, context) => createHtmlObjectResponse())

  handler.use(
    httpSecurityHeaders({
      dnsPrefetchControl: {
        allow: true
      },
      strictTransportSecurity: {
        includeSubDomains: false,
        preload: false
      },
      poweredBy: {
        server: 'Other'
      },
      permittedCrossDomainPolicies: {
        policy: 'all'
      },
      xssProtection: {
        reportTo: 'https://example.com/report'
      }
    })
  )

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.is(response.statusCode, 200)
  t.is(response.headers['X-Permitted-Cross-Domain-Policies'], 'all')
  t.is(response.headers['X-DNS-Prefetch-Control'], 'on')
  t.is(response.headers['X-Powered-By'], 'Other')
  t.is(response.headers['Strict-Transport-Security'], 'max-age=15552000')
  t.is(
    response.headers['X-XSS-Protection'],
    '1; mode=block; report=https://example.com/report'
  )
})

test('It should support array responses', async (t) => {
  const handler = middy((event, context) => createArrayResponse())

  handler.use(httpSecurityHeaders())

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.deepEqual(response.body, [{ firstname: 'john', lastname: 'doe' }])
  t.is(response.statusCode, undefined)
  t.is(response.headers['Referrer-Policy'], 'no-referrer')
  t.is(response.headers['Strict-Transport-Security'], 'max-age=15552000; includeSubDomains; preload')
  t.is(response.headers['X-DNS-Prefetch-Control'], 'off')
  t.is(response.headers['X-Powered-By'], undefined)
  t.is(response.headers['X-Download-Options'], 'noopen')
  t.is(response.headers['X-Content-Type-Options'], 'nosniff')
  t.is(response.headers['X-Permitted-Cross-Domain-Policies'], 'none')

  t.is(response.headers['X-Frame-Options'], undefined)
  t.is(response.headers['X-XSS-Protection'], undefined)
})

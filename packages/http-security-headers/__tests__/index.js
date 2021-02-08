const test = require('ava')
const middy = require('../../core/index.js')
const httpSecurityHeaders = require('../index.js')

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
    const handler = middy((event, context) => createDefaultObjectResponse()
    )

    handler.use(httpSecurityHeaders())

    const event = {
      httpMethod: 'GET'
    }

    const response = await handler(event)

    t.is(response.statusCode,200)
    t.is(response.headers['X-DNS-Prefetch-Control'],'off')
    t.is(response.headers['X-Powered-By'],undefined)
    t.is(response.headers['Strict-Transport-Security'],'max-age=15552000; includeSubDomains; preload')
    t.is(response.headers['X-Download-Options'],'noopen')
    t.is(response.headers['X-Content-Type-Options'],'nosniff')
    t.is(response.headers['Referrer-Policy'],'no-referrer')
    t.is(response.headers['X-Permitted-Cross-Domain-Policies'],'none')

    t.is(response.headers['X-Frame-Options'],undefined)
    t.is(response.headers['X-XSS-Protection'],undefined)
  })

  test('It should return default security headers when HTML', async (t) => {
    const handler = middy((event, context) => createHtmlObjectResponse()
    )

    handler.use(httpSecurityHeaders())

    const event = {
      httpMethod: 'GET'
    }

    const response = await handler(event)

    t.is(response.headers['X-DNS-Prefetch-Control'],'off')
    t.is(response.headers['X-Powered-By'],undefined)
    t.is(response.headers['Strict-Transport-Security'],'max-age=15552000; includeSubDomains; preload')
    t.is(response.headers['X-Download-Options'],'noopen')
    t.is(response.headers['X-Content-Type-Options'],'nosniff')
    t.is(response.headers['Referrer-Policy'],'no-referrer')
    t.is(response.headers['X-Permitted-Cross-Domain-Policies'],'none')

    t.is(response.headers['X-Frame-Options'],'DENY')
    t.is(response.headers['X-XSS-Protection'],'1; mode=block')
  })

  test('It should modify default security headers', async (t) => {
    const handler = middy((event, context) => createHeaderObjectResponse()
    )

    handler.use(httpSecurityHeaders())

    const event = {
      httpMethod: 'GET'
    }

    const response = await handler(event)

    t.is(response.statusCode,200)
    t.is(response.headers.Server,undefined)
    t.is(response.headers['X-Powered-By'],undefined)
  })

  test('It should modify default security headers with config set', async (t) => {
    const handler = middy((event, context) => createHtmlObjectResponse()
    )

    handler.use(httpSecurityHeaders({
      dnsPrefetchControl: {
        allow: true
      },
      hsts: {
        includeSubDomains: false,
        preload: false
      },
      hidePoweredBy: {
        setTo: 'Other'
      },
      permittedCrossDomainPolicies: {
        policy: 'all'
      },
      xssFilter: {
        reportUri: 'https://example.com/report'
      }
    }))

    const event = {
      httpMethod: 'GET'
    }

    const response = await handler(event)

    t.is(response.statusCode,200)
    t.is(response.headers['X-Permitted-Cross-Domain-Policies'],'all')
    t.is(response.headers['X-DNS-Prefetch-Control'],'on')
    t.is(response.headers['X-Powered-By'],'Other')
    t.is(response.headers['Strict-Transport-Security'],'max-age=15552000')
    t.is(response.headers['X-XSS-Protection'],'1; mode=block; report=https://example.com/report')
  })

  test('It should support array responses', async (t) => {
    const handler = middy((event, context) => createArrayResponse())

    handler.use(httpSecurityHeaders())

    const event = {
      httpMethod: 'GET'
    }

    const response = await handler(event)

    t.deepEqual(response.body,[{ firstname: 'john', lastname: 'doe' }])
    t.is(response.statusCode,undefined)
    t.is(response.headers['X-DNS-Prefetch-Control'],'off')
    t.is(response.headers['X-Powered-By'],undefined)
    t.is(response.headers['Strict-Transport-Security'],'max-age=15552000; includeSubDomains; preload')
    t.is(response.headers['X-Download-Options'],'noopen')
    t.is(response.headers['X-Content-Type-Options'],'nosniff')
    t.is(response.headers['Referrer-Policy'],'no-referrer')
    t.is(response.headers['X-Permitted-Cross-Domain-Policies'],'none')

    t.is(response.headers['X-Frame-Options'],undefined)
    t.is(response.headers['X-XSS-Protection'],undefined)
  })

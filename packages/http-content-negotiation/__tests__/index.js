import test from 'ava'
import middy from '../../core/index.js'
import httpContentNegotiation from '../index.js'

const context = {
  getRemainingTimeInMillis: () => 1000
}

test.serial(
  'It should parse charset, encoding, language and media type',
  async (t) => {
    const handler = middy((event, context) => context)
    handler.use(
      httpContentNegotiation({
        availableCharsets: ['utf-8'],
        availableEncodings: undefined,
        availableLanguages: ['en-ca'],
        availableMediaTypes: ['text/plain', 'text/x-dvi']
      })
    )

    const event = {
      headers: {
        'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
        'Accept-Encoding': '*/*',
        'Accept-Language': 'da, en-ca;q=0.8, en;q=0.7',
        Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
      }
    }

    const resultingContext = await handler(event, context)

    t.deepEqual(resultingContext, {
      ...context,
      preferredCharsets: ['utf-8'],
      preferredCharset: 'utf-8',
      preferredEncodings: ['*/*', 'identity'],
      preferredEncoding: '*/*',
      preferredLanguages: ['en-ca'],
      preferredLanguage: 'en-ca',
      preferredMediaTypes: ['text/x-dvi', 'text/plain'],
      preferredMediaType: 'text/x-dvi'
    })
  }
)

test.serial('It should error when unfound preferred locale', async (t) => {
  const handler = middy((event, context) => context)
  handler.use(
    httpContentNegotiation({
      parseCharsets: false,
      parseEncodings: false,
      availableLanguages: ['en-CA'],
      parseMediaTypes: false
    })
  )

  const event = {
    headers: {
      'Accept-Language': 'en-us'
    }
  }
  try {
    await handler(event, context)
  } catch (e) {
    t.is(e.message, 'Unsupported Language. Acceptable values: en-CA')
  }
})

test.serial(
  'It should parse charset, encoding, language and media type with lowercase headers',
  async (t) => {
    const handler = middy((event, context) => context)
    handler.use(
      httpContentNegotiation({
        availableCharsets: ['utf-16'],
        availableEncodings: ['br', 'gzip'],
        availableLanguages: ['en-ca'],
        availableMediaTypes: ['text/plain', 'text/x-dvi']
      })
    )

    const event = {
      headers: {
        'accept-charset': 'utf-16, iso-8859-5, unicode-1-1;q=0.8',
        'accept-encoding': 'gzip, br, deflate',
        'accept-language': 'da, en-ca;q=0.8, en;q=0.7',
        accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
      }
    }

    const resultingContext = await handler(event, context)

    t.deepEqual(resultingContext, {
      ...context,
      preferredCharsets: ['utf-16'],
      preferredCharset: 'utf-16',
      preferredEncodings: ['gzip', 'br'],
      preferredEncoding: 'gzip',
      preferredLanguages: ['en-ca'],
      preferredLanguage: 'en-ca',
      preferredMediaTypes: ['text/x-dvi', 'text/plain'],
      preferredMediaType: 'text/x-dvi'
    })
  }
)

test.serial(
  'It should default charset, encoding, language and media type when there is a mismatch',
  async (t) => {
    const handler = middy((event, context) => context)
    handler.use(
      httpContentNegotiation({
        availableCharsets: ['utf-16'],
        defaultToFirstCharset: true,
        availableEncodings: ['br', 'gzip'],
        defaultToFirstEncoding: true,
        availableLanguages: ['en'],
        defaultToFirstLanguage: true,
        availableMediaTypes: ['text/plain'],
        defaultToFirstMediaType: true
      })
    )

    const event = {
      headers: {
        'accept-charset': 'iso-8859-5, unicode-1-1;q=0.8',
        'accept-encoding': 'deflate',
        'accept-language': 'da, fr;q=0.8',
        accept: 'text/html, text/x-dvi; q=0.8, text/x-c'
      }
    }

    const resultingContext = await handler(event, context)

    t.deepEqual(resultingContext, {
      ...context,
      preferredCharsets: [],
      preferredCharset: 'utf-16',
      preferredEncodings: [],
      preferredEncoding: 'br',
      preferredLanguages: [],
      preferredLanguage: 'en',
      preferredMediaTypes: [],
      preferredMediaType: 'text/plain'
    })
  }
)

test.serial(
  'It should skip the middleware if no headers are sent',
  async (t) => {
    const handler = middy((event, context) => event)
    handler.use(
      httpContentNegotiation({
        availableCharsets: ['utf-8'],
        availableEncodings: undefined,
        availableLanguages: ['en-ca'],
        availableMediaTypes: ['text/plain', 'text/x-dvi']
      })
    )

    const event = {
      foo: 'bar'
    }

    const resultingEvent = await handler(event, context)

    t.deepEqual(resultingEvent, { foo: 'bar' })
  }
)

test.serial('It should not parse charset if disabled', async (t) => {
  const handler = middy((event, context) => context)
  handler.use(
    httpContentNegotiation({
      parseCharsets: false,
      availableEncodings: undefined,
      availableLanguages: ['en-ca'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    })
  )

  const event = {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-ca;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingContext = await handler(event, context)

  t.deepEqual(resultingContext, {
    ...context,
    preferredEncodings: ['*/*', 'identity'],
    preferredEncoding: '*/*',
    preferredLanguages: ['en-ca'],
    preferredLanguage: 'en-ca',
    preferredMediaTypes: ['text/x-dvi', 'text/plain'],
    preferredMediaType: 'text/x-dvi'
  })
})

test.serial('It should not parse encoding if disabled', async (t) => {
  const handler = middy((event, context) => context)
  handler.use(
    httpContentNegotiation({
      availableCharsets: ['utf-8'],
      parseEncodings: undefined,
      availableLanguages: ['en-ca'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    })
  )

  const event = {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-ca;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingContext = await handler(event, context)

  t.deepEqual(resultingContext, {
    ...context,
    preferredCharsets: ['utf-8'],
    preferredCharset: 'utf-8',
    preferredLanguages: ['en-ca'],
    preferredLanguage: 'en-ca',
    preferredMediaTypes: ['text/x-dvi', 'text/plain'],
    preferredMediaType: 'text/x-dvi'
  })
})

test('It should not parse language if disabled', async (t) => {
  const handler = middy((event, context) => context)
  handler.use(
    httpContentNegotiation({
      availableCharsets: ['utf-8'],
      availableEncodings: undefined,
      parseLanguages: false,
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    })
  )

  const event = {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-ca;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingContext = await handler(event, context)

  t.deepEqual(resultingContext, {
    ...context,
    preferredCharsets: ['utf-8'],
    preferredCharset: 'utf-8',
    preferredEncodings: ['*/*', 'identity'],
    preferredEncoding: '*/*',
    preferredMediaTypes: ['text/x-dvi', 'text/plain'],
    preferredMediaType: 'text/x-dvi'
  })
})

test.serial('It should not parse media types if disabled', async (t) => {
  const handler = middy((event, context) => context)
  handler.use(
    httpContentNegotiation({
      availableCharsets: ['utf-8'],
      availableEncodings: undefined,
      availableLanguages: ['en-ca'],
      parseMediaTypes: false
    })
  )

  const event = {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-ca;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingContext = await handler(event, context)

  t.deepEqual(resultingContext, {
    ...context,
    preferredCharsets: ['utf-8'],
    preferredCharset: 'utf-8',
    preferredEncodings: ['*/*', 'identity'],
    preferredEncoding: '*/*',
    preferredLanguages: ['en-ca'],
    preferredLanguage: 'en-ca'
  })
})

test.serial('It should fail when mismatching', async (t) => {
  const handler = middy((event, context) => context)
  handler.use(
    httpContentNegotiation({
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    })
  )

  const event = {
    headers: {
      Accept: 'application/json'
    }
  }

  try {
    await handler(event, context)
  } catch (e) {
    t.is(
      e.message,
      'Unsupported MediaType. Acceptable values: text/plain, text/x-dvi'
    )
  }
})

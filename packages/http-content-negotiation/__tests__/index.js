import test from 'ava'
import middy from '../../core/index.js'
import httpContentNegotiation from '../index.js'

const context = {
  getRemainingTimeInMillis: () => 1000
}

test('It should parse charset, encoding, language and media type', async (t) => {
  const handler = middy((event, context) => event)
  handler.use(
    httpContentNegotiation({
      availableCharsets: ['utf-8'],
      availableEncodings: undefined,
      availableLanguages: ['en-gb'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    })
  )

  const event = {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingEvent = await handler(event, context)

  t.deepEqual(resultingEvent, {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    },
    preferredCharsets: ['utf-8'],
    preferredCharset: 'utf-8',
    preferredEncodings: ['*/*', 'identity'],
    preferredEncoding: '*/*',
    preferredLanguages: ['en-gb'],
    preferredLanguage: 'en-gb',
    preferredMediaTypes: ['text/x-dvi', 'text/plain'],
    preferredMediaType: 'text/x-dvi'
  })
})

test('It should parse charset, encoding, language and media type with lowercase headers', async (t) => {
  const handler = middy((event, context) => event)
  handler.use(
    httpContentNegotiation({
      availableCharsets: ['utf-16'],
      availableEncodings: ['br', 'gzip'],
      availableLanguages: ['en-gb'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    })
  )

  const event = {
    headers: {
      'accept-charset': 'utf-16, iso-8859-5, unicode-1-1;q=0.8',
      'accept-encoding': 'gzip, br, deflate',
      'accept-language': 'da, en-gb;q=0.8, en;q=0.7',
      accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingEvent = await handler(event, context)

  t.deepEqual(resultingEvent, {
    headers: {
      'accept-charset': 'utf-16, iso-8859-5, unicode-1-1;q=0.8',
      'accept-encoding': 'gzip, br, deflate',
      'accept-language': 'da, en-gb;q=0.8, en;q=0.7',
      accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    },
    preferredCharsets: ['utf-16'],
    preferredCharset: 'utf-16',
    preferredEncodings: ['gzip', 'br'],
    preferredEncoding: 'gzip',
    preferredLanguages: ['en-gb'],
    preferredLanguage: 'en-gb',
    preferredMediaTypes: ['text/x-dvi', 'text/plain'],
    preferredMediaType: 'text/x-dvi'
  })
})

test('It should default charset, encoding, language and media type when there is a mismatch', async (t) => {
  const handler = middy((event, context) => event)
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

  const resultingEvent = await handler(event, context)

  t.deepEqual(resultingEvent, {
    headers: {
      'accept-charset': 'iso-8859-5, unicode-1-1;q=0.8',
      'accept-encoding': 'deflate',
      'accept-language': 'da, fr;q=0.8',
      accept: 'text/html, text/x-dvi; q=0.8, text/x-c'
    },
    preferredCharsets: [],
    preferredCharset: 'utf-16',
    preferredEncodings: [],
    preferredEncoding: 'br',
    preferredLanguages: [],
    preferredLanguage: 'en',
    preferredMediaTypes: [],
    preferredMediaType: 'text/plain'
  })
})

test('It should skip the middleware if no headers are sent', async (t) => {
  const handler = middy((event, context) => event)
  handler.use(
    httpContentNegotiation({
      availableCharsets: ['utf-8'],
      availableEncodings: undefined,
      availableLanguages: ['en-gb'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    })
  )

  const event = {
    foo: 'bar'
  }

  const resultingEvent = await handler(event, context)

  t.deepEqual(resultingEvent, { foo: 'bar' })
})

test('It should not parse charset if disabled', async (t) => {
  const handler = middy((event, context) => event)
  handler.use(
    httpContentNegotiation({
      parseCharsets: false,
      availableEncodings: undefined,
      availableLanguages: ['en-gb'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    })
  )

  const event = {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingEvent = await handler(event, context)

  t.deepEqual(resultingEvent, {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    },
    preferredEncodings: ['*/*', 'identity'],
    preferredEncoding: '*/*',
    preferredLanguages: ['en-gb'],
    preferredLanguage: 'en-gb',
    preferredMediaTypes: ['text/x-dvi', 'text/plain'],
    preferredMediaType: 'text/x-dvi'
  })
})

test('It should not parse encoding if disabled', async (t) => {
  const handler = middy((event, context) => event)
  handler.use(
    httpContentNegotiation({
      availableCharsets: ['utf-8'],
      parseEncodings: undefined,
      availableLanguages: ['en-gb'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    })
  )

  const event = {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingEvent = await handler(event, context)

  t.deepEqual(resultingEvent, {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    },
    preferredCharsets: ['utf-8'],
    preferredCharset: 'utf-8',
    preferredLanguages: ['en-gb'],
    preferredLanguage: 'en-gb',
    preferredMediaTypes: ['text/x-dvi', 'text/plain'],
    preferredMediaType: 'text/x-dvi'
  })
})

test('It should not parse language if disabled', async (t) => {
  const handler = middy((event, context) => event)
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
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingEvent = await handler(event, context)

  t.deepEqual(resultingEvent, {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    },
    preferredCharsets: ['utf-8'],
    preferredCharset: 'utf-8',
    preferredEncodings: ['*/*', 'identity'],
    preferredEncoding: '*/*',
    preferredMediaTypes: ['text/x-dvi', 'text/plain'],
    preferredMediaType: 'text/x-dvi'
  })
})

test('It should not parse media types if disabled', async (t) => {
  const handler = middy((event, context) => event)
  handler.use(
    httpContentNegotiation({
      availableCharsets: ['utf-8'],
      availableEncodings: undefined,
      availableLanguages: ['en-gb'],
      parseMediaTypes: false
    })
  )

  const event = {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const resultingEvent = await handler(event, context)

  t.deepEqual(resultingEvent, {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
    },
    preferredCharsets: ['utf-8'],
    preferredCharset: 'utf-8',
    preferredEncodings: ['*/*', 'identity'],
    preferredEncoding: '*/*',
    preferredLanguages: ['en-gb'],
    preferredLanguage: 'en-gb'
  })
})

test('It should fail when mismatching', async (t) => {
  const handler = middy((event, context) => event)
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

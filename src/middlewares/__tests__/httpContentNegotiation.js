const middy = require('../../middy')
const httpContentNegotiation = require('../httpContentNegotiation')

describe('🤑  Middleware HTTP Content Negotiation', () => {
  test('It should parse charset, encoding, language and media type', (endTest) => {
    const handler = middy((event, context, callback) => callback(null, event))
    handler.use(httpContentNegotiation({
      availableCharsets: ['utf-8'],
      availableEncodings: undefined,
      availableLanguages: ['en-gb'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    }))

    const event = {
      headers: {
        'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
        'Accept-Encoding': '*/*',
        'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
        'Accept': 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
      }
    }

    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.preferredCharsets).toEqual(['utf-8'])
      expect(resultingEvent.preferredCharset).toEqual('utf-8')
      expect(resultingEvent.preferredEncodings).toEqual(['*/*', 'identity'])
      expect(resultingEvent.preferredEncoding).toEqual('*/*')
      expect(resultingEvent.preferredLanguages).toEqual(['en-gb'])
      expect(resultingEvent.preferredLanguage).toEqual('en-gb')
      expect(resultingEvent.preferredMediaTypes).toEqual(['text/x-dvi', 'text/plain'])
      expect(resultingEvent.preferredMediaType).toEqual('text/x-dvi')

      endTest()
    })
  })

  test('It should skip the middleware if no headers are sent', (endTest) => {
    const handler = middy((event, context, callback) => callback(null, event))
    handler.use(httpContentNegotiation({
      availableCharsets: ['utf-8'],
      availableEncodings: undefined,
      availableLanguages: ['en-gb'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    }))

    const event = {
      foo: 'bar'
    }

    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent).toEqual({ foo: 'bar' })
      endTest()
    })
  })

  test('It should not parse charset if disabled', (endTest) => {
    const handler = middy((event, context, callback) => callback(null, event))
    handler.use(httpContentNegotiation({
      parseCharsets: false,
      availableEncodings: undefined,
      availableLanguages: ['en-gb'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    }))

    const event = {
      headers: {
        'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
        'Accept-Encoding': '*/*',
        'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
        'Accept': 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
      }
    }

    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.preferredCharsets).toBeUndefined()
      expect(resultingEvent.preferredCharset).toBeUndefined()
      expect(resultingEvent.preferredEncodings).toEqual(['*/*', 'identity'])
      expect(resultingEvent.preferredEncoding).toEqual('*/*')
      expect(resultingEvent.preferredLanguages).toEqual(['en-gb'])
      expect(resultingEvent.preferredLanguage).toEqual('en-gb')
      expect(resultingEvent.preferredMediaTypes).toEqual(['text/x-dvi', 'text/plain'])
      expect(resultingEvent.preferredMediaType).toEqual('text/x-dvi')

      endTest()
    })
  })

  test('It should not parse encoding if disabled', (endTest) => {
    const handler = middy((event, context, callback) => callback(null, event))
    handler.use(httpContentNegotiation({
      availableCharsets: ['utf-8'],
      parseEncodings: undefined,
      availableLanguages: ['en-gb'],
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    }))

    const event = {
      headers: {
        'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
        'Accept-Encoding': '*/*',
        'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
        'Accept': 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
      }
    }

    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.preferredCharsets).toEqual(['utf-8'])
      expect(resultingEvent.preferredCharset).toEqual('utf-8')
      expect(resultingEvent.preferredEncodings).toBeUndefined()
      expect(resultingEvent.preferredEncoding).toBeUndefined()
      expect(resultingEvent.preferredLanguages).toEqual(['en-gb'])
      expect(resultingEvent.preferredLanguage).toEqual('en-gb')
      expect(resultingEvent.preferredMediaTypes).toEqual(['text/x-dvi', 'text/plain'])
      expect(resultingEvent.preferredMediaType).toEqual('text/x-dvi')

      endTest()
    })
  })

  test('It should not parse language if disabled', (endTest) => {
    const handler = middy((event, context, callback) => callback(null, event))
    handler.use(httpContentNegotiation({
      availableCharsets: ['utf-8'],
      availableEncodings: undefined,
      parseLanguages: false,
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    }))

    const event = {
      headers: {
        'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
        'Accept-Encoding': '*/*',
        'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
        'Accept': 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
      }
    }

    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.preferredCharsets).toEqual(['utf-8'])
      expect(resultingEvent.preferredCharset).toEqual('utf-8')
      expect(resultingEvent.preferredEncodings).toEqual(['*/*', 'identity'])
      expect(resultingEvent.preferredEncoding).toEqual('*/*')
      expect(resultingEvent.preferredLanguages).toBeUndefined()
      expect(resultingEvent.preferredLanguage).toBeUndefined()
      expect(resultingEvent.preferredMediaTypes).toEqual(['text/x-dvi', 'text/plain'])
      expect(resultingEvent.preferredMediaType).toEqual('text/x-dvi')

      endTest()
    })
  })

  test('It should not parse media types if disabled', (endTest) => {
    const handler = middy((event, context, callback) => callback(null, event))
    handler.use(httpContentNegotiation({
      availableCharsets: ['utf-8'],
      availableEncodings: undefined,
      availableLanguages: ['en-gb'],
      parseMediaTypes: false
    }))

    const event = {
      headers: {
        'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
        'Accept-Encoding': '*/*',
        'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
        'Accept': 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
      }
    }

    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.preferredCharsets).toEqual(['utf-8'])
      expect(resultingEvent.preferredCharset).toEqual('utf-8')
      expect(resultingEvent.preferredEncodings).toEqual(['*/*', 'identity'])
      expect(resultingEvent.preferredEncoding).toEqual('*/*')
      expect(resultingEvent.preferredLanguages).toEqual(['en-gb'])
      expect(resultingEvent.preferredLanguage).toEqual('en-gb')
      expect(resultingEvent.preferredMediaTypes).toBeUndefined()
      expect(resultingEvent.preferredMediaType).toBeUndefined()

      endTest()
    })
  })

  test('It should fail when mismatching', (endTest) => {
    const handler = middy((event, context, callback) => callback(null, event))
    handler.use(httpContentNegotiation({
      availableMediaTypes: ['text/plain', 'text/x-dvi']
    }))

    const event = {
      headers: {
        'Accept': 'application/json'
      }
    }

    handler(event, {}, (err, resultingEvent) => {
      expect(err.message).toEqual('Unsupported mediaType. Acceptable values: text/plain, text/x-dvi')
      endTest()
    })
  })
})

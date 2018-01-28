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
    // TODO
    endTest()
  })

  test('It should not parse charset if disabled', (endTest) => {
    // TODO
    endTest()
  })

  test('It should not parse encoding if disabled', (endTest) => {
    // TODO
    endTest()
  })

  test('It should not parse language if disabled', (endTest) => {
    // TODO
    endTest()
  })

  test('It should not parse media types if disabled', (endTest) => {
    // TODO
    endTest()
  })

  test('It should fail with mismatching charset', (endTest) => {
    // TODO
    endTest()
  })

  test('It should fail with mismatching encoding', (endTest) => {
    // TODO
    endTest()
  })

  test('It should fail with mismatching language', (endTest) => {
    // TODO
    endTest()
  })

  test('It should fail with mismatching media type', (endTest) => {
    // TODO
    endTest()
  })
})

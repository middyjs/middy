const middy = require('../../middy')
const multipartFormDataParser = require('../multipartFormDataParser')

describe('📦  Middleware Multipart Form Data Body Parser', () => {
  test('It should parse a JSON request', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    handler.use(multipartFormDataParser())

    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
      },
      body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0='

    }
    handler(event, {}, (_, body) => {
      expect(body).toEqual({ foo: 'bar' })
    })
  })

  test('It should handle invalid form data as an UnprocessableEntity', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    handler.use(multipartFormDataParser())

    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
      },
      body: 'make it broken'
    }
    handler(event, {}, (err) => {
      expect(err.message).toEqual('Invalid or malformed multipart/form-data was provided.')
    })
  })

  test('It shouldn\'t process the body if no header is passed', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    handler.use(multipartFormDataParser())

    // invokes the handler
    const event = {
      body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0='
    }
    handler(event, {}, (_, body) => {
      expect(body).toEqual('LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=')
    })
  })
})

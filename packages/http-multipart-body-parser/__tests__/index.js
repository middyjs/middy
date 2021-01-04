import test from 'ava'
import middy from '../../core/index.js'
import httpMultipartBodyParser from '../index.js'

test('It should parse a non-file field from a multipart/form-data request', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  // invokes the handler
  // Base64 encoded form data with field 'foo' of value 'bar'
  const event = {
    headers: {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
    },
    body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t',
    isBase64Encoded: true
  }
  const response = await handler(event)

  t.deepEqual(response, { foo: 'bar' })
})

test('parseMultipartData should resolve with valid data', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  const event = {
    headers: {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
    },
    body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t',
    isBase64Encoded: true
  }

  const response = await handler(event)
  t.deepEqual(response, { foo: 'bar' })
})

test('It should parse a file field from a multipart/form-data request', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  // Base64 encoded form data with a file with fieldname 'attachment', filename 'test.txt', and contents 'hello world!'
  const event = {
    headers: {
      'content-type': 'multipart/form-data; boundary=------------------------4f0e69e6c2513684'
    },
    body: 'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS00ZjBlNjllNmMyNTEzNjg0DQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImF0dGFjaG1lbnQiOyBmaWxlbmFtZT0idGVzdC50eHQiDQpDb250ZW50LVR5cGU6IHRleHQvcGxhaW4NCg0KaGVsbG8gd29ybGQhCg0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS00ZjBlNjllNmMyNTEzNjg0LS0NCg==',
    isBase64Encoded: true
  }

  const response = await handler(event)

  t.not(response.attachment, undefined)
  t.not(response.attachment.content, undefined)
})
//
test('It should handle invalid form data as an UnprocessableEntity', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  // invokes the handler
  const event = {
    headers: {
      'content-type': 'multipart/form-data; boundary=------WebKitFormBoundaryfdmza9FgfefwkQzA'
    },
    body: null,
    isBase64Encoded: true
  }

  try {
    await handler(event)
  } catch (e) {
    t.is(e.message, 'Invalid or malformed multipart/form-data was provided')
  }
})

test('It should handle more invalid form data as an UnprocessableEntity', async (t) => {
  // Body contains LF instead of CRLF line endings, which cant be processed
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  const event = {
    headers: {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
    },
    body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=',
    isBase64Encoded: true
  }

  try {
    await handler(event)
  } catch (e) {
    t.is(e.message, 'Invalid or malformed multipart/form-data was provided')
  }
})

test('It shouldn\'t process the body if no headers are passed', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  // invokes the handler
  const event = {
    body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0='
  }

  const response = await handler(event)

  t.is(response, 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=')
})

test('It shouldn\'t process the body if the content type is not multipart/form-data', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  // invokes the handler
  const event = {
    headers: {
      'content-type': 'application/json'
    },
    body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0='
  }
  const response = await handler(event)
  t.is(response, 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=')
})

test('It shouldn\'t process the body if headers are passed without content type', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  // invokes the handler
  const event = {
    headers: {
      accept: 'application/json'
    },
    body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0='
  }

  const response = await handler(event)
  t.is(response, 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=')
})

test('It should parse an array from a multipart/form-data request (base64)', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  const event = {
    headers: {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
    },
    body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb29bXSINCg0Kb25lDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNDQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvb1tdIg0KDQp0d28NCi0tLS0tLVdlYktpdEZvcm1Cb3VuZGFyeXBwc1FFd2YyQlZKZUNlME0tLQ==',
    isBase64Encoded: true
  }
  const response = await handler(event)

  t.not(response.foo, undefined)
  t.is(response.foo.length, 2)
})

test('It should parse an array from a multipart/form-data request (binary)', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(httpMultipartBodyParser())

  const event = {
    headers: {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
    },
    body: '',
    isBase64Encoded: false
  }
  const response = await handler(event)

  // TODO add in better test for binary
  t.deepEqual(response, { })
})


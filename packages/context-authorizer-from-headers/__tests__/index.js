const { invoke } = require('../../test-helpers')
const middy = require('@middy/core')
const contextAuthorizerMapper = require('..')

describe('📦 Middleware Context Authorizer from Headers', () => {
  test('It should map events from handler to context authorizer', async () => {
    const event = {
      headers: {
        userRef: 'test-user-ref',
        customer: 'test-customer'
      }
    }
    const handler = middy((event, context, cb) => cb(null, event))

    const mapper = [
      { headerKey: 'userRef', contextKey: 'userRef' },
      { headerKey: 'customer', contextKey: 'customer' }
    ]

    handler.use(contextAuthorizerMapper({ mapper }))

    await invoke(handler, event)

    expect(event.requestContext).toStrictEqual({
      authorizer: {
        userRef: 'test-user-ref',
        customer: 'test-customer'
      }
    })
  })
  test('It should map events from handler to context authorizer and do not remove other context params', async () => {
    const event = {
      headers: {
        userRef: 'test-user-ref',
        customer: 'test-customer'
      },
      requestContext: {
        pricipalId: 'testPrincipal'
      }
    }
    const handler = middy((event, context, cb) => cb(null, event))

    const mapper = [
      { headerKey: 'userRef', contextKey: 'userRef' },
      { headerKey: 'customer', contextKey: 'customer' }
    ]

    handler.use(contextAuthorizerMapper({ mapper }))

    await invoke(handler, event)

    expect(event.requestContext).toStrictEqual({
      authorizer: {
        userRef: 'test-user-ref',
        customer: 'test-customer'
      },
      pricipalId: 'testPrincipal'
    })
  })
  test('It should map events from handler to context authorizer and do not remove other authorizer params', async () => {
    const event = {
      headers: {
        userRef: 'test-user-ref',
        customer: 'test-customer'
      },
      requestContext: {
        pricipalId: 'testPrincipal',
        authorizer: {
          extraKey: 'extraKey'
        }
      }
    }
    const handler = middy((event, context, cb) => cb(null, event))

    const mapper = [
      { headerKey: 'userRef', contextKey: 'userRef' },
      { headerKey: 'customer', contextKey: 'customer' }
    ]

    handler.use(contextAuthorizerMapper({ mapper }))

    await invoke(handler, event)

    expect(event.requestContext).toStrictEqual({
      authorizer: {
        userRef: 'test-user-ref',
        customer: 'test-customer',
        extraKey: 'extraKey'
      },
      pricipalId: 'testPrincipal'
    })
  })
})

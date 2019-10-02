jest.mock('aws-sdk')

const { SecretsManager } = require('aws-sdk')
const middy = require('../../middy')
const secretsManager = require('../secretsManager')

describe('🔒 SecretsManager Middleware', () => {
  const getSecretValueMock = jest.fn()
  SecretsManager.prototype.getSecretValue = getSecretValueMock

  beforeEach(() => {
    getSecretValueMock.mockReset()
    getSecretValueMock.mockClear()
  })

  const hasRDSLogin = (context, password = 'password') => {
    expect(typeof context.KEY_NAME).toEqual('object')
    expect(context.KEY_NAME).toHaveProperty('Username')
    expect(context.KEY_NAME.Username).toEqual('username')
    expect(context.KEY_NAME).toHaveProperty('Password')
    expect(context.KEY_NAME.Password).toEqual(password)
  }

  const hasAPIKey = context => {
    expect(typeof context.API_KEY).toEqual('object')
    expect(context.API_KEY).toHaveProperty('ApiKey')
    expect(context.API_KEY.ApiKey).toEqual('apikey')
  }

  function testScenario ({ mockResponse, mockResponses, middlewareOptions, callbacks, done, delay = 0 }) {
    if (mockResponses) {
      mockResponses.forEach(resp => {
        getSecretValueMock.mockReturnValueOnce({
          promise: () => Promise.resolve(resp)
        })
      })
    } else if (mockResponse) {
      getSecretValueMock.mockReturnValue({
        promise: () => Promise.resolve(mockResponse)
      })
    }

    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(secretsManager(middlewareOptions))

    const event = {}
    let promise = Promise.resolve()
    callbacks.forEach(cb => {
      let context = {}
      promise = promise.then(() => {
        return new Promise((resolve, reject) => {
          handler(event, context, (error, response) => {
            if (error) return reject(error)
            try {
              cb(error, { event, context, response })
              resolve()
            } catch (err) {
              reject(err)
            }
          })
        })
      }).then(() => {
        if (delay) {
          return new Promise((resolve, reject) => {
            setTimeout(resolve, delay)
          })
        }
      })
    })
    promise.then(done).catch(done)
  }

  test(`It should set secrets to context`, (done) => {
    testScenario({
      mockResponse: {
        SecretString: JSON.stringify({ Username: 'username', Password: 'password' })
      },
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'rds_login'
        }
      },
      callbacks: [
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()
        }
      ],
      done
    })
  })

  test(`It should not call aws-sdk again if secret is cached`, (done) => {
    testScenario({
      mockResponse: {
        SecretString: JSON.stringify({ Username: 'username', Password: 'password' })
      },
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'rds_login'
        },
        cache: true
      },
      callbacks: [
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()
          getSecretValueMock.mockClear()
        },
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).not.toBeCalled()
        }
      ],
      done
    })
  })

  test(`It should call aws-sdk if cache enabled but cached secrets have expired`, (done) => {
    testScenario({
      mockResponse: {
        SecretString: JSON.stringify({ Username: 'username', Password: 'password' })
      },
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'rds_login'
        },
        cache: true,
        cacheExpiryInMillis: 10
      },
      callbacks: [
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()
          getSecretValueMock.mockClear()
        },
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()
        }
      ],
      done,
      delay: 20 // 20 > 10, so cache has expired
    })
  })

  test(`It should not call aws-sdk if cache enabled and cached param has not expired`, (done) => {
    testScenario({
      mockResponse: {
        SecretString: JSON.stringify({ Username: 'username', Password: 'password' })
      },
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'rds_login'
        },
        cache: true,
        cacheExpiryInMillis: 50
      },
      callbacks: [
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()
          getSecretValueMock.mockClear()
        },
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).not.toBeCalled()
        }
      ],
      done,
      delay: 20 // 20 < 50, so cache has not expired
    })
  })

  test(`It should not throw error when empty middleware params passed`, (done) => {
    testScenario({
      mockResponse: {},
      middlewareOptions: {},
      callbacks: [
        (error) => {
          expect(error).toBeFalsy()
          expect(getSecretValueMock).not.toBeCalled()
        }
      ],
      done
    })
  })

  test(`It should use cache secrets if refresh fails`, (done) => {
    testScenario({
      mockResponse: {
        SecretString: JSON.stringify({ Username: 'username', Password: 'password' })
      },
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'rds_login'
        },
        cache: true,
        cacheExpiryInMillis: 10
      },
      callbacks: [
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()
          getSecretValueMock.mockReturnValueOnce({
            promise: () => Promise.reject(new Error('oops'))
          })
        },
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()
        }
      ],
      done,
      delay: 20 // 20 > 10, so cache has expired
    })
  })

  test(`It should fail if "throwOnFailedCall" flag provided and call failed`, (done) => {
    const errorMessage = 'Internal Error / Secret doesn\'t exist'
    getSecretValueMock.mockReturnValueOnce({
      promise: () => Promise.reject(new Error(errorMessage))
    })

    const errHandler = err => {
      getSecretValueMock.mockClear()
      expect(err.message).toEqual(errorMessage)
      done()
    }
    return testScenario({
      mockResponse: {},
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'failed_call'
        },
        throwOnFailedCall: true
      },
      callbacks: [
        () => {
          throw new Error('Not supposed to be called')
        }
      ],
      done: errHandler
    })
  })

  test(`It should resolve if "throwOnFailedCall" flag not provided and call failed`, (done) => {
    const errorMessage = 'Internal Error / Secret doesn\'t exist'
    getSecretValueMock.mockReturnValueOnce({
      promise: () => Promise.reject(new Error(errorMessage))
    })
    return testScenario({
      mockResponse: {},
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'failed_call'
        }
      },
      callbacks: [
        (_, { context }) => {
          expect(getSecretValueMock).toBeCalled()
          getSecretValueMock.mockClear()
        }
      ],
      done
    })
  })

  test(`It should resolve if "throwOnFailedCall" flag provided but item already cached`, (done) => {
    const errorMessage = 'Internal Error / Secret doesn\'t exist'
    return testScenario({
      mockResponse: {
        SecretString: JSON.stringify({ Username: 'username', Password: 'password' })
      },
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'rds_key'
        },
        throwOnFailedCall: true
      },
      callbacks: [
        // invocation 1: fetched
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()

          getSecretValueMock.mockClear()

          // set up next attempt to fail
          getSecretValueMock.mockReturnValueOnce({
            promise: () => Promise.reject(new Error(errorMessage))
          })
        },
        // invocation 2: failed but content taken from cache
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()
          getSecretValueMock.mockClear()
        }
      ],
      done
    })
  })

  test(`It should only refresh once per cache expiry window`, (done) => {
    // with cache expiry of 50ms, test what happens when one refresh fails, and
    // that the middleware doesn't retry for another 50ms
    // 0ms (fetch), 40ms (cached), 80ms (retry failed), 120ms (no retry), 160ms (retry)
    testScenario({
      mockResponse: {
        SecretString: JSON.stringify({ Username: 'username', Password: 'password' })
      },
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'rds_login'
        },
        cache: true,
        cacheExpiryInMillis: 50
      },
      callbacks: [
        // invocation 1: fetched
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()

          getSecretValueMock.mockClear()

          // set up next attempt to fail
          getSecretValueMock.mockReturnValueOnce({
            promise: () => Promise.reject(new Error('oops'))
          })
        },
        // invocation 2: cache hasn't expired
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).not.toBeCalled()
        },
        // invocation 3: cache expired, retry failed, reusing cache
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).toBeCalled()

          getSecretValueMock.mockClear()

          // set up next attempt to succeed
          getSecretValueMock.mockReturnValueOnce({
            promise: () => Promise.resolve({
              SecretString: JSON.stringify({ Username: 'username', Password: 'new password' })
            })
          })
        },
        // invocation 4: no retry, expiry hasn't passed since last retry
        (_, { context }) => {
          hasRDSLogin(context)
          expect(getSecretValueMock).not.toBeCalled()
        },
        // invocation 5: expiry passed, retried and succeed, new password is used!
        (_, { context }) => {
          hasRDSLogin(context, 'new password')
          expect(getSecretValueMock).toBeCalled()
        }
      ],
      done,
      delay: 40
    })
  })

  test('It should retrieve multiple secrets', (done) => {
    testScenario({
      mockResponses: [
        { SecretString: JSON.stringify({ Username: 'username', Password: 'password' }) },
        { SecretString: JSON.stringify({ ApiKey: 'apikey' }) }
      ],
      middlewareOptions: {
        secrets: {
          KEY_NAME: 'rds_login',
          API_KEY: 'api_key'
        }
      },
      callbacks: [
        (_, { context }) => {
          hasRDSLogin(context)
          hasAPIKey(context)
          expect(getSecretValueMock).toBeCalled()
        }
      ],
      done
    })
  })
})

jest.mock('aws-sdk')

const {SSM} = require('aws-sdk')
const middy = require('../../middy')
const ssm = require('../ssm')
const Promise = require('bluebird')

describe('🔒 SSM Middleware', () => {
  const getParametersMock = jest.fn()
  SSM.prototype.getParameters = getParametersMock
  const getParametersByPathMock = jest.fn()
  SSM.prototype.getParametersByPath = getParametersByPathMock

  beforeEach(() => {
    getParametersMock.mockReset()
    getParametersMock.mockClear()
    getParametersByPathMock.mockReset()
    getParametersByPathMock.mockClear()
    delete process.env.MONGO_URL
    delete process.env.OTHER_MONGO_URL
    delete process.env.SERVICE_NAME_MONGO_URL
  })

  const testScenario = ({ssmMockResponse, middlewareOptions, callbacks, done, delay = 0}) => {
    getParametersMock.mockReturnValueOnce({
      promise: () => Promise.resolve(ssmMockResponse)
    })

    getParametersByPathMock.mockReturnValue({
      promise: () => Promise.resolve(ssmMockResponse)
    })

    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(ssm(middlewareOptions))

    const event = {}
    let promise = Promise.resolve()
    callbacks.forEach(cb => {
      let context = {}
      promise = promise.then(() => {
        return new Promise((resolve, reject) => {
          handler(event, context, (error, response) => {
            try {
              cb(error, {event, context, response})
              resolve()
            } catch (err) {
              reject(err)
            }
          })
        })
      }).then(() => {
        if (delay) {
          return Promise.delay(delay)
        }
      })
    })
    promise.then(done).catch(err => done(err))
  }

  test(`It should set SSM param value to environment variable by default`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/mongo_url', Value: 'my-mongo-url'}]
      },
      middlewareOptions: {
        names: {
          MONGO_URL: '/dev/service_name/mongo_url'
        }
      },
      callbacks: [
        () => {
          expect(process.env.MONGO_URL).toEqual('my-mongo-url')
        }
      ],
      done
    })
  })

  test(`It should not call aws-sdk again if parameter is cached in env`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/mongo_url', Value: 'my-mongo-url'}]
      },
      middlewareOptions: {
        names: {
          MONGO_URL: '/dev/service_name/mongo_url'
        },
        cache: true
      },
      callbacks: [
        () => {
          expect(getParametersMock).toBeCalledWith({'Names': ['/dev/service_name/mongo_url'], 'WithDecryption': true})
          getParametersMock.mockReset()
        },
        () => {
          expect(getParametersMock).not.toBeCalled()
        }
      ],
      done
    })
  })

  test(`It should not call aws-sdk again if parameter is cached in context`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/secure_param', Value: 'something-secure'}]
      },
      context: {
        // simulate already cached value
        secureValue: '/dev/service_name/secure_param'
      },
      middlewareOptions: {
        names: {
          secureValue: '/dev/service_name/secure_param'
        },
        cache: true,
        setToContext: true
      },
      callbacks: [
        () => {
          expect(getParametersMock).toBeCalledWith({'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true})
          getParametersMock.mockReset()
        },
        () => {
          expect(getParametersMock).not.toBeCalled()
        }
      ],
      done
    })
  })

  test(`It should call aws-sdk if cache enabled but param not cached`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/secure_param', Value: 'something-secure'}]
      },
      middlewareOptions: {
        names: {
          secureValue: '/dev/service_name/secure_param'
        },
        cache: true,
        setToContext: true,
        paramsLoaded: false
      },
      callbacks: [
        () => {
          expect(getParametersMock).toBeCalledWith({'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true})
        }
      ],
      done
    })
  })

  test(`It should call aws-sdk if cache enabled but cached param has expired`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/secure_param', Value: 'something-secure'}]
      },
      middlewareOptions: {
        names: {
          secureValue: '/dev/service_name/secure_param'
        },
        cache: true,
        cacheExpiryInMillis: 10,
        setToContext: true,
        paramsLoaded: false
      },
      callbacks: [
        () => {
          expect(getParametersMock).toBeCalledWith({'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true})
          getParametersMock.mockReset()
        },
        () => {
          expect(getParametersMock).toBeCalledWith({'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true})
        }
      ],
      done,
      delay: 20 // 20 > 10, so cache has expired
    })
  })

  test(`It should not call aws-sdk if cache enabled and cached param has not expired`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/secure_param', Value: 'something-secure'}]
      },
      middlewareOptions: {
        names: {
          secureValue: '/dev/service_name/secure_param'
        },
        cache: true,
        cacheExpiryInMillis: 50,
        setToContext: true,
        paramsLoaded: false
      },
      callbacks: [
        () => {
          expect(getParametersMock).toBeCalledWith({'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true})
          getParametersMock.mockReset()
        },
        () => {
          expect(getParametersMock).not.toBeCalled()
        }
      ],
      done,
      delay: 20 // 20 < 50, so cache has not expired
    })
  })

  test(`It should set SSM param value to context if set in options`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/secure_param', Value: 'something-secure'}]
      },
      middlewareOptions: {
        names: {
          secureValue: '/dev/service_name/secure_param'
        },
        setToContext: true
      },
      callbacks: [
        (_, {context}) => {
          expect(context.secureValue).toEqual('something-secure')
        }
      ],
      done
    })
  })

  test(`It should throw error when some SSM params are invalid`, (done) => {
    testScenario({
      ssmMockResponse: {
        InvalidParameters: ['invalid-smm-param-name', 'another-invalid-ssm-param']
      },
      middlewareOptions: {
        names: {
          invalidParam: 'invalid-smm-param-name',
          anotherInvalidParam: 'another-invalid-ssm-param'
        }
      },
      callbacks: [
        (error) => {
          expect(error.message).toEqual('InvalidParameters present: invalid-smm-param-name, another-invalid-ssm-param')
        }
      ],
      done
    })
  })

  test(`It should not throw error when empty middleware params passed`, (done) => {
    testScenario({
      ssmMockResponse: {},
      middlewareOptions: {},
      callbacks: [
        (error) => {
          expect(error).toBeFalsy()
        }
      ],
      done
    })
  })

  test('It should set properties on target with names equal to full parameter name sans specified path', (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/mongo_url', Value: 'my-mongo-url'}]
      },
      middlewareOptions: {
        paths: {'': '/dev/service_name'}
      },
      callbacks: [
        () => {
          expect(process.env.MONGO_URL).toEqual('my-mongo-url')
        }
      ],
      done
    })
  })

  test('It should retrieve params from multiple paths', (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/mongo_url', Value: 'my-mongo-url'}]
      },
      middlewareOptions: {
        paths: {'': ['/dev/service_name'], 'prefix': '/dev'}
      },
      callbacks: [
        () => {
          expect(process.env.MONGO_URL).toEqual('my-mongo-url')
          expect(process.env.PREFIX_SERVICE_NAME_MONGO_URL).toEqual('my-mongo-url')
        }
      ],
      done
    })
  })
})

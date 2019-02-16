jest.mock('aws-sdk')

const { SSM } = require('aws-sdk')
const middy = require('../../middy')
const ssm = require('../ssm')

describe('🔒 SSM Middleware', () => {
  const getParametersMock = jest.fn()
  SSM.prototype.getParameters = getParametersMock
  const getParametersByPathMock = jest.fn()
  SSM.prototype.getParametersByPath = getParametersByPathMock
  const onChange = jest.fn()

  beforeEach(() => {
    getParametersMock.mockReset()
    getParametersMock.mockClear()
    getParametersByPathMock.mockReset()
    getParametersByPathMock.mockClear()
    onChange.mockReset()
    onChange.mockClear()
    delete process.env.KEY_NAME
  })

  function testScenario ({ ssmMockResponse, ssmMockResponses, middlewareOptions, callbacks, done, delay = 0 }) {
    (ssmMockResponses || [ssmMockResponse]).forEach(ssmMockResponse => {
      getParametersMock.mockReturnValue({
        promise: () => Promise.resolve(ssmMockResponse)
      })

      getParametersByPathMock.mockReturnValueOnce({
        promise: () => Promise.resolve(ssmMockResponse)
      })
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
    promise.then(done).catch(err => done(err))
  }

  test(`It should set SSM param value to environment variable by default`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
      },
      middlewareOptions: {
        names: {
          KEY_NAME: '/dev/service_name/key_name'
        }
      },
      callbacks: [
        () => {
          expect(process.env.KEY_NAME).toEqual('key-value')
        }
      ],
      done
    })
  })

  test(`It should not call aws-sdk again if parameter is cached in env`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
      },
      middlewareOptions: {
        names: {
          KEY_NAME: '/dev/service_name/key_name'
        },
        cache: true
      },
      callbacks: [
        () => {
          expect(process.env.KEY_NAME).toEqual('key-value')
          expect(getParametersMock).toBeCalled()
          getParametersMock.mockClear()
        },
        () => {
          expect(process.env.KEY_NAME).toEqual('key-value')
          expect(getParametersMock).not.toBeCalled()
        }
      ],
      done
    })
  })

  test(`It should not call aws-sdk again if parameter is cached in context`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{ Name: '/dev/service_name/secure_param', Value: 'something-secure' }]
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
        (_, { context }) => {
          expect(context.secureValue).toEqual('something-secure')
          expect(getParametersMock).toBeCalledWith({ 'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true })
          getParametersMock.mockClear()
        },
        (_, { context }) => {
          expect(context.secureValue).toEqual('something-secure')
          expect(getParametersMock).not.toBeCalled()
        }
      ],
      done
    })
  })

  test(`It should call aws-sdk if cache enabled but param not cached`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{ Name: '/dev/service_name/secure_param', Value: 'something-secure' }]
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
        (_, { context }) => {
          expect(context.secureValue).toEqual('something-secure')
          expect(getParametersMock).toBeCalledWith({ 'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true })
        }
      ],
      done
    })
  })

  test(`It should call onChange handler on first run`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{ Name: '/dev/service_name/secure_param', Value: 'something-secure' }]
      },
      middlewareOptions: {
        names: {
          secureValue: '/dev/service_name/secure_param'
        },
        cache: true,
        onChange: onChange,
        setToContext: true,
        paramsLoaded: false
      },
      callbacks: [
        (_, { context }) => {
          expect(onChange).toHaveBeenCalledTimes(1)
          expect(context.secureValue).toEqual('something-secure')
          expect(getParametersMock).toBeCalledWith({ 'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true })
        }
      ],
      done
    })
  })

  test(`It should call aws-sdk if cache enabled but cached param has expired`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{ Name: '/dev/service_name/secure_param', Value: 'something-secure' }]
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
        (_, { context }) => {
          expect(context.secureValue).toEqual('something-secure')
          expect(getParametersMock).toBeCalledWith({ 'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true })
          getParametersMock.mockClear()
        },
        (_, { context }) => {
          expect(context.secureValue).toEqual('something-secure')
          expect(getParametersMock).toBeCalledWith({ 'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true })
        }
      ],
      done,
      delay: 20 // 20 > 10, so cache has expired
    })
  })

  test(`It should call onChange along with aws-sdk if cache enabled but cached param has expired`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{ Name: '/dev/service_name/secure_param', Value: 'something-secure' }]
      },
      middlewareOptions: {
        names: {
          secureValue: '/dev/service_name/secure_param'
        },
        cache: true,
        onChange: onChange,
        cacheExpiryInMillis: 10,
        setToContext: true,
        paramsLoaded: false
      },
      callbacks: [
        (_, { context }) => {
          expect(onChange).toHaveBeenCalledTimes(1)
          expect(context.secureValue).toEqual('something-secure')
          expect(getParametersMock).toBeCalledWith({ 'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true })
          getParametersMock.mockClear()
        },
        (_, { context }) => {
          expect(onChange).toHaveBeenCalledTimes(2)
          expect(context.secureValue).toEqual('something-secure')
          expect(getParametersMock).toBeCalledWith({ 'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true })
        }
      ],
      done,
      delay: 20 // 20 > 10, so cache has expired
    })
  })

  test(`It should not call aws-sdk if cache enabled and cached param has not expired`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{ Name: '/dev/service_name/secure_param', Value: 'something-secure' }]
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
        (_, { context }) => {
          expect(context.secureValue).toEqual('something-secure')
          expect(getParametersMock).toBeCalledWith({ 'Names': ['/dev/service_name/secure_param'], 'WithDecryption': true })
          getParametersMock.mockClear()
        },
        (_, { context }) => {
          expect(context.secureValue).toEqual('something-secure')
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
        Parameters: [{ Name: '/dev/service_name/secure_param', Value: 'something-secure' }]
      },
      middlewareOptions: {
        names: {
          secureValue: '/dev/service_name/secure_param'
        },
        setToContext: true
      },
      callbacks: [
        (_, { context }) => {
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
        Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
      },
      middlewareOptions: {
        paths: { '': '/dev/service_name' }
      },
      callbacks: [
        () => {
          expect(process.env.KEY_NAME).toEqual('key-value')
        }
      ],
      done
    })
  })

  test('It should retrieve params from multiple paths', (done) => {
    const ssmMockResponse = {
      Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
    }
    testScenario({
      ssmMockResponses: [ssmMockResponse, ssmMockResponse],
      middlewareOptions: {
        paths: { '': ['/dev/service_name'], 'prefix': '/dev' }
      },
      callbacks: [
        () => {
          expect(process.env.KEY_NAME).toEqual('key-value')
          expect(process.env.PREFIX_SERVICE_NAME_KEY_NAME).toEqual('key-value')
        }
      ],
      done
    })
  })

  test('It should make multiple API calls for a single path if the response contains a token for additional params', (done) => {
    testScenario({
      ssmMockResponses: [
        {
          Parameters: [{ Name: '/dev/service_name/key_name1', Value: 'key-value1' }],
          NextToken: 'token'
        },
        {
          Parameters: [{ Name: '/dev/service_name/key_name2', Value: 'key-value2' }]
        }
      ],
      middlewareOptions: {
        paths: { '': ['/dev/service_name'] }
      },
      callbacks: [
        () => {
          expect(process.env.KEY_NAME1).toEqual('key-value1')
          expect(process.env.KEY_NAME2).toEqual('key-value2')
        }
      ],
      done
    })
  })
})

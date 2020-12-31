
jest.mock('aws-sdk')

import {SSM} from '@aws-sdk/client-ssm'
import middy from '../../core/index.js'
import ssm from '../index.js'


  const getParametersMock = sinon.spy()
  SSM.prototype.getParameters = getParametersMock
  const getParametersByPathMock = sinon.spy()
  SSM.prototype.getParametersByPath = getParametersByPathMock
  const onChange = sinon.spy()

  beforeEach(() => {
    getParametersMock.mockReset()
    getParametersMock.mockClear()
    getParametersByPathMock.mockReset()
    getParametersByPathMock.mockClear()
    onChange.mockReset()
    onChange.mockClear()
    delete process.env.KEY_NAME
  })

  async function testScenario ({ ssmMockResponse, ssmMockResponses, middlewareOptions, callbacks, delay = 0 }) {
    (ssmMockResponses || [ssmMockResponse]).forEach(ssmMockResponse => {
      getParametersMock.mockReturnValue({
        promise: () => Promise.resolve(ssmMockResponse)
      })

      getParametersByPathMock.mockReturnValueOnce({
        promise: () => Promise.resolve(ssmMockResponse)
      })
    })

    const handler = middy((event, context) => {
      cb()
    })
    handler.use(ssm(middlewareOptions))

    const event = {}
    let promise = Promise.resolve()
    callbacks.forEach(cb => {
      const context = {}
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
          return new Promise((resolve) => {
            setTimeout(resolve, delay)
          })
        }
      })
    })

    await promise
  }

  test('It should set SSM param value to environment variable by default', async (t) => {
    await testScenario({
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
          t.is(process.env.KEY_NAME,'key-value')
        }
      ]
    })
  })

  test('It should not call aws-sdk again if parameter is cached in env', async (t) => {
    await testScenario({
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
          t.is(process.env.KEY_NAME,'key-value')
          expect(getParametersMock).toBeCalled()
          getParametersMock.mockClear()
        },
        () => {
          t.is(process.env.KEY_NAME,'key-value')
          expect(getParametersMock).not.toBeCalled()
        }
      ]
    })
  })

  test('It should not call aws-sdk again if parameter is cached in context', async (t) => {
    await testScenario({
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
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).toBeCalledWith({ Names: ['/dev/service_name/secure_param'], WithDecryption: true })
          getParametersMock.mockClear()
        },
        (_, { context }) => {
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).not.toBeCalled()
        }
      ]
    })
  })

  test('It should call aws-sdk if cache enabled but param not cached', async (t) => {
    await testScenario({
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
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).toBeCalledWith({ Names: ['/dev/service_name/secure_param'], WithDecryption: true })
        }
      ]
    })
  })

  test('It should call onChange handler on first run', async (t) => {
    await testScenario({
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
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).toBeCalledWith({ Names: ['/dev/service_name/secure_param'], WithDecryption: true })
        }
      ]
    })
  })

  test('It should call aws-sdk if cache enabled but cached param has expired', async (t) => {
    await testScenario({
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
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).toBeCalledWith({ Names: ['/dev/service_name/secure_param'], WithDecryption: true })
          getParametersMock.mockClear()
        },
        (_, { context }) => {
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).toBeCalledWith({ Names: ['/dev/service_name/secure_param'], WithDecryption: true })
        }
      ],
      delay: 20 // 20 > 10, so cache has expired
    })
  })

  test('It should call onChange along with aws-sdk if cache enabled but cached param has expired', async (t) => {
    await testScenario({
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
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).toBeCalledWith({ Names: ['/dev/service_name/secure_param'], WithDecryption: true })
          getParametersMock.mockClear()
        },
        (_, { context }) => {
          expect(onChange).toHaveBeenCalledTimes(2)
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).toBeCalledWith({ Names: ['/dev/service_name/secure_param'], WithDecryption: true })
        }
      ],
      delay: 20 // 20 > 10, so cache has expired
    })
  })

  test('It should not call aws-sdk if cache enabled and cached param has not expired', async (t) => {
    await testScenario({
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
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).toBeCalledWith({ Names: ['/dev/service_name/secure_param'], WithDecryption: true })
          getParametersMock.mockClear()
        },
        (_, { context }) => {
          t.is(context.secureValue,'something-secure')
          expect(getParametersMock).not.toBeCalled()
        }
      ],
      delay: 20 // 20 < 50, so cache has not expired
    })
  })

  test('It should set SSM param value to context if set in options', async (t) => {
    await testScenario({
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
          t.is(context.secureValue,'something-secure')
        }
      ]
    })
  })

  test('It should throw error when some SSM params are invalid and "throwOnFailedCall" flag is set to true', async (t) => {
    await testScenario({
      ssmMockResponse: {
        InvalidParameters: ['invalid-smm-param-name', 'another-invalid-ssm-param']
      },
      middlewareOptions: {
        names: {
          invalidParam: 'invalid-smm-param-name',
          anotherInvalidParam: 'another-invalid-ssm-param'
        },
        throwOnFailedCall: true
      },
      callbacks: [
        (error) => {
          t.is(error.message,'InvalidParameters present: invalid-smm-param-name, another-invalid-ssm-param')
        }
      ]
    })
  })

  test('It should resolve if "throwOnFailedCall" flag is not provided but some SSM params are invalid (will throw silently?)', async (t) => {
    await testScenario({
      ssmMockResponse: {
        InvalidParameters: ['invalid-smm-param-name', 'another-invalid-ssm-param']
      },
      middlewareOptions: {
        names: {
          invalidParam: 'invalid-smm-param-name',
          anotherInvalidParam: 'another-invalid-ssm-param'
        },
        throwOnFailedCall: false
      },
      callbacks: [
        (_) => {
          expect(_).toBeNull() // TODO: don't know how to test this properly... there is no mockObject to check whether was called or not! (Check if console.error prints '[Failed to get parameters from SSM] ...' ?)
        },
        () => {
          expect(getParametersMock).toBeCalled()
          expect(getParametersMock).toHaveBeenCalledTimes(2)
          getParametersMock.mockClear()
        }
      ]
    })
  })

  test('It should not throw error when empty middleware params passed', async (t) => {
    await testScenario({
      ssmMockResponse: {},
      middlewareOptions: {},
      callbacks: [
        (error) => {
          expect(error).toBeFalsy()
        }
      ]
    })
  })

  test('It should set properties on target with names equal to full parameter name sans specified path', async (t) => {
    await testScenario({
      ssmMockResponse: {
        Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
      },
      middlewareOptions: {
        paths: { '': '/dev/service_name' }
      },
      callbacks: [
        () => {
          t.is(process.env.KEY_NAME,'key-value')
        }
      ]
    })
  })

  test('It should retrieve params from multiple paths', async (t) => {
    const ssmMockResponse = {
      Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
    }
    await testScenario({
      ssmMockResponses: [ssmMockResponse, ssmMockResponse],
      middlewareOptions: {
        paths: { '': ['/dev/service_name'], prefix: '/dev' }
      },
      callbacks: [
        () => {
          t.is(process.env.KEY_NAME,'key-value')
          t.is(process.env.PREFIX_SERVICE_NAME_KEY_NAME,'key-value')
        }
      ]
    })
  })

  test('It should make multiple API calls for a single path if the response contains a token for additional params', async (t) => {
    await testScenario({
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
          t.is(process.env.KEY_NAME1,'key-value1')
          t.is(process.env.KEY_NAME2,'key-value2')
        }
      ]
    })
  })

  test('It should allow multiple option names to point at the same SSM path', async (t) => {
    await testScenario({
      ssmMockResponses: [
        {
          Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
        }
      ],
      middlewareOptions: {
        names: {
          KEY_NAME_1: '/dev/service_name/key_name',
          KEY_NAME_2: '/dev/service_name/key_name'
        }
      },
      callbacks: [
        () => {
          t.is(process.env.KEY_NAME_1,'key-value')
          t.is(process.env.KEY_NAME_2,'key-value')
        }
      ]
    })
  })
})

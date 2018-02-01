jest.mock('aws-sdk')

const {SSM} = require('aws-sdk')
const middy = require('../../middy')
const ssm = require('../ssm')

describe('🔒 SSM Middleware', () => {
  const getParametersMock = jest.fn()
  SSM.prototype.getParameters = getParametersMock

  beforeEach(() => {
    getParametersMock.mockReset()
    getParametersMock.mockClear()
    delete process.env.MONGO_URL
  })

  function testScenario ({ssmMockResponse, middlewareOptions, context = {}, cb}) {
    getParametersMock.mockReturnValueOnce({
      promise: () => Promise.resolve(ssmMockResponse)
    })

    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(ssm(middlewareOptions))

    const event = {}
    handler(event, context, (error, response) => {
      cb(error, {event, context, response})
    })
  }

  test(`It should set SSM param value to environment variable by default`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/mongo_url', Value: 'my-mongo-url'}]
      },
      middlewareOptions: {
        params: {
          MONGO_URL: '/dev/service_name/mongo_url'
        }
      },
      cb () {
        expect(process.env.MONGO_URL).toEqual('my-mongo-url')
        done()
      }
    })
  })

  test(`It should not call aws-sdk again if parameter is cached in env`, (done) => {
    // simulate already cached value
    process.env.MONGO_URL = 'some-value'

    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/mongo_url', Value: 'my-mongo-url'}]
      },
      middlewareOptions: {
        params: {
          MONGO_URL: '/dev/service_name/mongo_url'
        },
        cache: true
      },
      cb () {
        expect(getParametersMock).not.toBeCalled()
        done()
      }
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
        params: {
          secureValue: '/dev/service_name/secure_param'
        },
        cache: true,
        setToContext: true
      },
      cb () {
        expect(getParametersMock).not.toBeCalled()
        done()
      }
    })
  })

  test(`It should set SSM param value to context if set in options`, (done) => {
    testScenario({
      ssmMockResponse: {
        Parameters: [{Name: '/dev/service_name/secure_param', Value: 'something-secure'}]
      },
      middlewareOptions: {
        params: {
          secureValue: '/dev/service_name/secure_param'
        },
        setToContext: true
      },
      cb (_, {context}) {
        expect(context.secureValue).toEqual('something-secure')
        done()
      }
    })
  })

  test(`It should throw error when some SSM params are invalid`, (done) => {
    testScenario({
      ssmMockResponse: {
        InvalidParameters: ['invalid-smm-param-name', 'another-invalid-ssm-param']
      },
      middlewareOptions: {
        params: {
          invalidParam: 'invalid-smm-param-name',
          anotherInvalidParam: 'another-invalid-ssm-param'
        }
      },
      cb (error) {
        expect(error.message).toEqual('InvalidParameters present: invalid-smm-param-name, another-invalid-ssm-param')
        done()
      }
    })
  })

  test(`It should not throw error when empty middleware params passed`, (done) => {
    testScenario({
      ssmMockResponse: {},
      middlewareOptions: {},
      cb (error) {
        expect(error).toBeFalsy()
        done()
      }
    })
  })
})

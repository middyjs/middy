jest.mock('knex')

const knex = require('knex')

const middy = require('../../middy')
const dbManager = require('../dbManager')

describe('💾  Database manager', () => {
  let destroyFn
  let clientMock
  beforeEach(() => {
    destroyFn = jest.fn()
    clientMock = jest.fn(() => ({
      destroy: destroyFn
    }))
  })

  afterEach(() => {
    clientMock.mockReset()
    destroyFn.mockReset()
  })

  test('it should create db instance with default config', (done) => {
    knex.mockReturnValue(clientMock())
    const handler = middy((event, context, cb) => {
      expect(context.db).toEqual(clientMock()) // compare invocations, not functions
      return cb(null, event.body) // propagates the body as a response
    })

    handler.use(dbManager({
      config: {}
    }))

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (err, body) => {
      expect(err).toEqual(null)
      expect(body).toEqual('{"foo":"bar"}')
      expect(destroyFn).toHaveBeenCalledTimes(0)
      done()
    })
  })

  test('it should destroy instance if forceNewConnection flag provided', (done) => {
    knex.mockReturnValue(clientMock())
    const handler = middy((event, context, cb) => {
      expect(context.db).toEqual(clientMock()) // compare invocations, not functions
      return cb(null, event.body) // propagates the body as a response
    })

    handler.use(dbManager({
      config: {},
      forceNewConnection: true
    }))

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (err, body) => {
      expect(err).toEqual(null)
      expect(body).toEqual('{"foo":"bar"}')
      expect(destroyFn).toHaveBeenCalledTimes(1)
      done()
    })
  })

  test('it should throw if no config provided', (done) => {
    const returnedValue = jest.fn(clientMock)
    knex.mockReturnValue(returnedValue)
    const handler = middy((event, context, cb) => {
      expect(context.db).toEqual(returnedValue)
      return cb(null, event.body) // propagates the body as a response
    })

    handler.use(dbManager({
      forceNewConnection: true
    }))

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (err) => {
      expect(err).toBeTruthy()
      expect(err.message).toEqual('Config is required in dbManager')
      done()
    })
  })

  test('it should initialize custom client', (done) => {
    const newClient = jest.fn().mockReturnValue(clientMock)
    const config = {
      connection: {
        user: '1234',
        password: '56678'
      }
    }
    const handler = middy((event, context, cb) => {
      expect(context.db.toString()).toEqual(clientMock.toString()) // compare invocations, not functions
      expect(newClient).toHaveBeenCalledTimes(1)
      expect(newClient).toHaveBeenCalledWith(config)
      return cb(null, event.body) // propagates the body as a response
    })

    handler.use(dbManager({
      client: newClient,
      config,
      forceNewConnection: true
    }))

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (err, body) => {
      expect(err).toEqual(null)
      expect(body).toEqual('{"foo":"bar"}')
      done()
    })
  })

  test('it should grab connection details from context', (done) => {
    const newClient = jest.fn().mockReturnValue(clientMock)
    const secretsPath = 'secret_location'
    const connection = {
      user: '1234',
      password: '56678'
    }
    const config = {
      connection: {
        host: '127.0.0.1'
      }
    }
    const handler = middy((event, context, cb) => {
      expect(context.db.toString()).toEqual(clientMock.toString()) // compare invocations, not functions
      expect(newClient).toHaveBeenCalledTimes(1)
      Object.assign(config.connection, { connection }) // add details that are supposed be in context
      expect(newClient).toHaveBeenCalledWith(config)
      return cb(null, event.body) // propagates the body as a response
    })

    handler.use({
      before: (handler, next) => {
        handler.context[secretsPath] = connection
        next()
      }
    })

    handler.use(dbManager({
      client: newClient,
      config,
      secretsPath,
      forceNewConnection: true
    }))

    handler.use({
      after: (handler, next) => {
        expect(handler.context[secretsPath]).toBeUndefined()
        next()
      }
    })

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (err, body) => {
      expect(err).toEqual(null)
      expect(body).toEqual('{"foo":"bar"}')
      done()
    })
  })

  test('it should grab connection details from context even if connection object doesn\'t exist', (done) => {
    const newClient = jest.fn().mockReturnValue(clientMock)
    const secretsPath = 'secret_location'
    const connection = {
      host: '127.0.0.1',
      user: '1234',
      password: '56678'
    }
    const config = {
    }
    const handler = middy((event, context, cb) => {
      expect(context.db.toString()).toEqual(clientMock.toString()) // compare invocations, not functions
      expect(newClient).toHaveBeenCalledTimes(1)
      Object.assign(config.connection, { connection }) // add details that are supposed be in context
      expect(newClient).toHaveBeenCalledWith(config)
      return cb(null, event.body) // propagates the body as a response
    })

    handler.use({
      before: (handler, next) => {
        handler.context[secretsPath] = connection
        next()
      }
    })

    handler.use(dbManager({
      client: newClient,
      config,
      secretsPath,
      forceNewConnection: true
    }))

    handler.use({
      after: (handler, next) => {
        expect(handler.context[secretsPath]).toBeUndefined()
        next()
      }
    })

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (err, body) => {
      expect(err).toEqual(null)
      expect(body).toEqual('{"foo":"bar"}')
      done()
    })
  })

  test('it should grab connection details and not delete details from context if removeSecrets = false', (done) => {
    const newClient = jest.fn().mockReturnValue(clientMock)
    const secretsPath = 'secret_location'
    const connection = {
      host: '127.0.0.1',
      user: '1234',
      password: '56678'
    }
    const config = {
    }
    const handler = middy((event, context, cb) => {
      expect(context.db.toString()).toEqual(clientMock.toString()) // compare invocations, not functions
      expect(newClient).toHaveBeenCalledTimes(1)
      Object.assign(config.connection, { connection }) // add details that are supposed be in context
      expect(newClient).toHaveBeenCalledWith(config)
      return cb(null, event.body) // propagates the body as a response
    })

    handler.use({
      before: (handler, next) => {
        handler.context[secretsPath] = connection
        next()
      }
    })

    handler.use(dbManager({
      client: newClient,
      config,
      secretsPath,
      removeSecrets: false,
      forceNewConnection: true
    }))

    handler.use({
      after: (handler, next) => {
        expect(handler.context[secretsPath]).toEqual(connection)
        next()
      }
    })

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (err, body) => {
      expect(err).toEqual(null)
      expect(body).toEqual('{"foo":"bar"}')
      done()
    })
  })
})

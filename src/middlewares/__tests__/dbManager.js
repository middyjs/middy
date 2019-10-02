jest.mock('knex')

const knex = require('knex')

const middy = require('../../middy')
const dbManager = require('../dbManager')

describe('💾  Database manager', () => {
  const clientMock = jest.fn().mockImplementation(() => ({
    destroy: jest.fn()
  }))
  test('it should create db instance with default config', (done) => {
    const returnedValue = jest.fn().mockReturnValue(clientMock)
    knex.mockReturnValue(returnedValue)
    const handler = middy((event, context, cb) => {
      expect(context.db).toEqual(returnedValue) // compare invocations, not functions
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
    const res = clientMock
    const newClient = jest.fn().mockReturnValue(clientMock)
    const config = {
      connection: {
        user: '1234',
        password: '56678'
      }
    }
    const handler = middy((event, context, cb) => {
      console.log(context.db, res)
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
})

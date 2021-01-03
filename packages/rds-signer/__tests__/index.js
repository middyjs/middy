import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import { getInternal, clearCache } from '../../core/util.js'
import RDS from 'aws-sdk/clients/rds.js' // v2
//import {RDS} from '@aws-sdk/client-rds' // v3
import rdsSigner from '../index.js'


let sandbox
test.beforeEach(t => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

const makeRdsSpy = (resp) => {
  // return sandbox.stub().returns(
  //   sinon.spy().returns({
  //     Signer: sinon.spy().returns({
  //       getAuthToken: sinon.spy().resolves(resp)
  //     })
  //   })
  // )
  return
}

test.serial('It should an authToken', async (t) => {
  const rdsSpy = sandbox.stub(RDS.prototype, 'Signer').returns({ getAuthToken: async ()=> 'token'})

  const handler = middy((event, context) => {})
  const middleware = async (handler) => {
    const values = await getInternal(true, handler)
    t.is(values.key, 'token')
  }
  //const rdsSpy = makeRdsSpy('token')
  handler
    .use(rdsSigner({
      AwsClient: rdsSpy,
      fetchData:{
        token: {
          region:'us-east-1', hostname:'hostname', username:'username', database:'database', port:5432
        }
      }
    } ))
    .before(middleware)

  await handler()

})

/*
let destroyFn
let clientMock

beforeEach(() => {
  RDS.Signer = class Signer {
    getAuthToken (options) { return 'token' }
  }
  destroyFn = sinon.spy()
  clientMock = jest.fn(() => ({
    destroy: destroyFn
  }))
})

afterEach(() => {
  clientMock.mockReset()
  destroyFn.mockReset()
})

test('it should create an authToken to be used as the password', () => {
  knex.mockReturnValue(clientMock())
  const newClient = sinon.spy().mockReturnValue(clientMock)
  const config = {
    connection: {
      host: '127.0.0.1',
      user: '1234',
      port: '5432'
    }
  }
  const handler = middy((event, context) => {
    t.is(context.db(), clientMock())
    expect(newClient).toHaveBeenCalledTimes(1)
    config.connection.password = 'token'
    expect(newClient).toHaveBeenCalledWith(config)
    return event.body // propagates the body as a response
  })

  handler.use(dbManager({
    client: newClient,
    rdsSigner: {
      region: 'us-east-1',
      hostname: '127.0.0.1',
      username: '1234',
      port: '5432'
    },
    config
  }))

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' })
  }
  handler(event, {}, (err, body) => {
    t.is(err, null)
    t.is(body, '{"foo":"bar"}')
  })
})

test('it should destroy instance if forceNewConnection flag provided', (done) => {
  knex.mockReturnValue(clientMock())
  const handler = middy((event, context) => {
    return
    return event.body // propagates the body as a response
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
    t.is(err, null)
    t.is(body, '{"foo":"bar"}')
    expect(destroyFn).toHaveBeenCalledTimes(1)
    done()
  })
})

test('it should throw if no config provided', (done) => {
  const returnedValue = jest.fn(clientMock)
  knex.mockReturnValue(returnedValue)
  const handler = middy((event, context) => {
    t.is(context.db, returnedValue)
    return
    return event.body // propagates the body as a response
  })

  handler.use(dbManager({
    forceNewConnection: true
  }))

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' })
  }
  handler(event, {}, (err) => {
    t.true(err)
    t.is(err.message, 'Config is required in dbManager')
    done()
  })
})

test('it should initialize custom client', (done) => {
  const newClient = sinon.spy().mockReturnValue(clientMock)
  const config = {
    connection: {
      user: '1234',
      password: '56678'
    }
  }
  const handler = middy((event, context) => {
    t.is(context.db.toString(), clientMock.toString()) // compare invocations, not functions
    expect(newClient).toHaveBeenCalledTimes(1)
    expect(newClient).toHaveBeenCalledWith(config)
    return
    return event.body // propagates the body as a response
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
    t.is(err, null)
    t.is(body, '{"foo":"bar"}')
    done()
  })
})

test('it should grab connection details from context', (done) => {
  const newClient = sinon.spy().mockReturnValue(clientMock)
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
  const handler = middy((event, context) => {
    t.is(context.db.toString(), clientMock.toString()) // compare invocations, not functions
    expect(newClient).toHaveBeenCalledTimes(1)
    Object.assign(config.connection, { connection }) // add details that are supposed be in context
    expect(newClient).toHaveBeenCalledWith(config)
    return
    return event.body // propagates the body as a response
  })

  handler.use({
    before: (handler) => {
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
    after: (handler) => {
      t.is(handler.context[secretsPath], undefined)
      next()
    }
  })

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' })
  }
  handler(event, {}, (err, body) => {
    t.is(err, null)
    t.is(body, '{"foo":"bar"}')
    done()
  })
})

test('it should grab connection details from context even if connection object doesn\'t exist', (done) => {
  const newClient = sinon.spy().mockReturnValue(clientMock)
  const secretsPath = 'secret_location'
  const connection = {
    host: '127.0.0.1',
    user: '1234',
    password: '56678'
  }
  const config = {}
  const handler = middy((event, context) => {
    t.is(context.db.toString(), clientMock.toString()) // compare invocations, not functions
    expect(newClient).toHaveBeenCalledTimes(1)
    Object.assign(config.connection, { connection }) // add details that are supposed be in context
    expect(newClient).toHaveBeenCalledWith(config)
    return
    return event.body // propagates the body as a response
  })

  handler.use({
    before: (handler) => {
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
    after: (handler) => {
      t.is(handler.context[secretsPath], undefined)
      next()
    }
  })

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' })
  }
  await handler(event, {})
    t.is(err, null)
    t.is(body, '{"foo":"bar"}')
    done()
  })
})

test('it should grab connection details and not delete details from context if removeSecrets = false', (done) => {
  const newClient = sinon.spy().mockReturnValue(clientMock)
  const secretsPath = 'secret_location'
  const connection = {
    host: '127.0.0.1',
    user: '1234',
    password: '56678'
  }
  const config = { connection }
  const handler = middy((event, context) => {
    t.is(context.db.toString(), clientMock.toString()) // compare invocations, not functions
    expect(newClient).toHaveBeenCalledTimes(1)
    Object.assign(config.connection, { connection }) // add details that are supposed be in context
    expect(newClient).toHaveBeenCalledWith(config)
    return
    return event.body // propagates the body as a response
  })

  handler.use({
    before: (handler) => {
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
    after: (handler) => {
      t.is(handler.context[secretsPath], connection)
      next()
    }
  })

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' })
  }
  await handler(event, {})
    t.is(err, null)
    t.is(body, '{"foo":"bar"}')
    done()
  })
})

*/
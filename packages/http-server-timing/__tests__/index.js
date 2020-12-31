import test from 'ava'
import middy from '../../core/index.js'
import serverTiming from '../index.js'

test('It should return default header with total time', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(serverTiming())

  const response = await handler()

  t.is(response.headers['Server-Timing'].substr(0,10),'total;dur=')
})

test('It should return default header with extra timing', async (t) => {
  const handler = middy((event, context) => {
    context.serverTiming.start('a')
    context.serverTiming.stop('a')
    return {}
  })

  handler.use(serverTiming({
    setContext:true
  }))

  const response = await handler()

  t.is(response.headers['Server-Timing'].substr(0,6),'a;dur=')
})

test('It should return default header with tags', async (t) => {
  const handler = middy((event, context) => {
    context.serverTiming.start('a')
    context.serverTiming.stop('a', 'desc')
    return {}
  })

  handler.use(serverTiming({
    setContext: true
  }))

  const response = await handler()

  t.is(response.headers['Server-Timing'].substr(0,18),'a;desc="desc";dur=')
})

test('It should return default header with extra timing and descriptions', async (t) => {
  const handler = middy((event, context) => ({}))

  handler
    .use(serverTiming({
      setContext: true
    }))
    .before((handler) => {
      handler.context.serverTiming.tag('a')
      handler.context.serverTiming.tag('b')
    })

  const response = await handler()

  t.is(response.headers['Server-Timing'].substr(0,5),'a, b,')
})
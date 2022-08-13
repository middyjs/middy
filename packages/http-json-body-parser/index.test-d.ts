import middy from '@middy/core'
import { expectType } from 'tsd'
import jsonBodyParser, { Event } from '.'

// use with default options
let middleware = jsonBodyParser()
expectType<middy.MiddlewareObj<Event>>(middleware)

// use with all options
middleware = jsonBodyParser({
  reviver: (key: string, value: any) => Boolean(value)
})
expectType<middy.MiddlewareObj<Event>>(middleware)

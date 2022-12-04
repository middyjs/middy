import { expectType } from 'tsd'
import middy from '@middy/core'
import Ajv from 'ajv'
import validator from '.'

// use with default options
let middleware = validator()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = validator({
  eventSchema: {},
  contextSchema: {},
  responseSchema: {},
  defaultLanguage: 'en',
  languages: {}
})
expectType<middy.MiddlewareObj>(middleware)

import { expectType } from 'tsd'
import middy from '@middy/core'
import Ajv from 'ajv'
import { transpileSchema, transpileLocale } from './transpile'

const schema = transpileSchema({ type: 'object' }, {})
expectType<any>(schema)

const locale = validator('', {})
expectType<any>(locale)

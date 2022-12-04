import { expectType } from 'tsd'
import { transpileSchema, transpileLocale } from './transpile'

const schema = transpileSchema({ type: 'object' }, {})
expectType<any>(schema)

const locale = transpileLocale('', {})
expectType<any>(locale)

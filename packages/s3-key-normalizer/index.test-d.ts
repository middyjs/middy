import { expectType } from 'tsd'
import middy from '@middy/core'
import s3KeyNormalizer from '.'

// use with default options
const middleware = s3KeyNormalizer()
expectType<middy.MiddlewareObj>(middleware)

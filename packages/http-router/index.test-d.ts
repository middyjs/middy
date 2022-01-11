import { expectType } from 'tsd'
// import middy from '@middy/core'
import httpRouterHandler from '.'

const middleware = httpRouterHandler()
expectType<any>(middleware)

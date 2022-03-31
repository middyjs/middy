import { expectType } from 'tsd'
// import middy from '@middy/core'
import wsRouterHandler from '.'

const middleware = wsRouterHandler()
expectType<any>(middleware)

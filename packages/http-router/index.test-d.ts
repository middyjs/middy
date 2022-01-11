import { expectType } from 'tsd'
//import middy from '@middy/core'
import httpRouterHandler from ".";

let middleware = httpRouterHandler()
expectType<any>(middleware)


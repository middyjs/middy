import middy from '@middy/core';
import httpRouterHandler from '.';
import { expectType } from 'tsd';

const middleware = httpRouterHandler({
    method: 'GET',
    path: '/',
    handler: () => true
});
expectType<middy.MiddlewareObj>(middleware);

import middy from '@middy/core';
import httpRouterHandler from '.';
import { expectType } from 'tsd';

const middleware = validator({
    method: 'GET',
    path: '/',
    handler: () => true
});
expectType<middy.MiddlewareObj>(middleware);

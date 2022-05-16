import middy from '@middy/core';

interface Routes {
    method: string;
    path: string;
    handler: middy.MiddyfiedHandler;
}

declare function httpRouterHandler(routes: Routes[]): middy.middlewarObj;

export default httpRouterHandler;
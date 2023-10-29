import middy from '@middy/core'
import { expectType } from 'tsd'
import { APIGatewayEvent, Context } from 'aws-lambda'
import jsonBodyParser, { Event } from '.'

// use with default options
let middleware = jsonBodyParser()
expectType<middy.MiddlewareObj<APIGatewayEvent, Event>>(middleware)

// use with all options
middleware = jsonBodyParser({
  reviver: (key: string, value: any) => Boolean(value)
})
expectType<middy.MiddlewareObj<APIGatewayEvent, Event>>(middleware)

const handler = (event: APIGatewayEvent, _context: Context) => {
  console.log(event.body);
};

const wrapped = middy(handler).use(jsonBodyParser());

const event: APIGatewayEvent = {} as any;
const context: Context = {} as any;

expectType<Parameters<typeof wrapped>[0]>(event);
expectType<Parameters<typeof wrapped>[1]>(context);

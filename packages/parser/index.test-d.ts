import { expectType } from 'tsd'
import middy from '@middy/core'
import parser from '.'
import { z, type ZodError } from 'zod';
import type { Context } from 'aws-lambda'
import { createError } from '@middy/util'
import { eventParsingErrorMessage } from './index'

// use with default options
const defaultMiddleware = parser()
expectType<middy.MiddlewareObj>(defaultMiddleware)

// use with all options
const fullMiddleware = parser({
  eventSchema: z.object({ body: z.string() }),
  contextSchema: z.object({ config: z.object({ batchSize: z.number().int() }) }),
  responseSchema: z.object({ results: z.array(z.string()).min(1).max(100) })
})
expectType<middy.MiddlewareObj<{ body: string }, { results: string[] }, Error, Context & { config: { batchSize: number } }>>(fullMiddleware)

// handler event and context has type correct inference
const handler = middy().use(fullMiddleware).handler(async (event, context) => {
  expectType<{ body: string }>(event)
  expectType<Context & { config: { batchSize: number } }>(context)
  return { results: [''] }
})

// event only
const eventMiddleware = parser({
  eventSchema: z.object({ body: z.object({ records: z.array(z.string()).min(1).max(100) }) })
})
expectType<middy.MiddlewareObj<{ body: { records: string[] } }, unknown, Error, Context>>(eventMiddleware)

// with a customError
const customErrorMiddleware = parser({
  eventSchema: z.object({ body: z.object({ records: z.array(z.string()).min(1).max(100) }) }),
  createErrorFunc: (status, message, { cause }) => {
    expectType<number>(status);
    expectType<string>(message);
    expectType<ZodError>(cause);
    if (message === eventParsingErrorMessage) {
      return createError(400, JSON.stringify({ code: '10003', message: cause.format()._errors.join(', ') }), { cause })
    }

    return createError(status, message, { cause })
  }
})
expectType<middy.MiddlewareObj<{ body: { records: string[] } }, unknown, Error, Context>>(customErrorMiddleware)

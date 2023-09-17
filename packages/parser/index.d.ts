import middy from '@middy/core'
import type { ZodSchema, ZodError, infer as Infer } from 'zod'
import type { Context } from 'aws-lambda'

export const eventParsingErrorMessage: string
export const contextParsingErrorMessage: string
export const responseParsingErrorMessage: string

interface Options<T, U, V> {
  eventSchema?: T
  contextSchema?: U
  responseSchema?: V
  createErrorFunc?: (statusCode: number, message: string, properties: { cause: ZodError }) => Error
}

declare function parser<
  T extends ZodSchema | undefined = undefined,
  U extends ZodSchema | undefined = undefined,
  V extends ZodSchema | undefined = undefined
> (options?: Options<T, U, V>): middy.MiddlewareObj<
T extends ZodSchema ? Infer<T> : unknown,
V extends ZodSchema ? Infer<V> : any,
Error,
U extends ZodSchema ? Infer<U> & Context : Context
>

export default parser

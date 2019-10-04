import Knex from 'knex'
import middy from '@middy/core'
import { Context } from 'aws-lambda';

export interface DbManagerOptions {
  client?: any,
  config: Knex.Config | Knex.AliasDict,
  forceNewConnection?: boolean,
  secretsPath?: string,
  removeSecrets?: boolean
}

interface DbManagerContext extends Context {
  [key: string]: Object;
}

export interface MiddyHandler extends middy.HandlerLambda {
  context: DbManagerContext
}

export type DbManagerClient = Knex | any

export type NextFunction = middy.NextFunction

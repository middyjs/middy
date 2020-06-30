import middy from '@middy/core';
import Knex from 'knex';

export interface DbManagerOptions {
  client?: any,
  config: Knex.Config | Knex.AliasDict,
  forceNewConnection?: boolean,
  rdsSigner?: any,
  removeSecrets?: boolean,
  secretsParam?: string,
  secretsPath?: string
}

declare const dbManager: middy.Middleware<DbManagerOptions, any, any>

export default dbManager

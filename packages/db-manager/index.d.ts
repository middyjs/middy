import Knex from 'knex';

export interface DbManagerOptions {
  client?: any,
  rdsSigner?: any,
  config: Knex.Config | Knex.AliasDict,
  forceNewConnection?: boolean,
  secretsPath?: string,
  removeSecrets?: boolean
}

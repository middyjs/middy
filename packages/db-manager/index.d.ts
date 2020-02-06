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

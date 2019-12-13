# Middy database manager

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>Simple database manager for the middy framework</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fvalidator">
    <img src="https://badge.fury.io/js/%40middy%2Fvalidator.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://greenkeeper.io/">
    <img src="https://badges.greenkeeper.io/middyjs/middy.svg" alt="Greenkeeper badge"  style="max-width:100%;">
  </a>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter"  style="max-width:100%;">
  </a>
</p>
</div>

dbManager provides seamless connection with database of your choice. By default it uses knex.js but you can use any tool that you want.

After initialization your database connection is accessible under:
```javascript
middy((event, context) => {
  const { db } = context;
});
```

Mind that if you use knex you will also need driver of your choice ([check docs](http://knexjs.org/#Installation-node)), for PostgreSQL that would be:
```
yarn add pg
// or
npm install pg
```


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/db-manager
```


## Options

- `config`: configuration object passed as is to client (knex.js by default), for more details check [knex documentation](http://knexjs.org/#Installation-client)
- `client` (optional): client that you want to use when connecting to database of your choice. By default knex.js is used but as long as your client is run as `client(config)` or you create wrapper to conform, you can use other tools. Due to node6 support in middy, knex is capped at version `0.17.3`. If you wish to use newer features, provide your own knex client here.
- `secretsPath` (optional): if for any reason you want to pass credentials using context, pass path to secrets laying in context object  - good example is combining this middleware with [ssm](#ssm)
- `removeSecrets` (optional): By default is true. Works only in combination with `secretsPath`. Removes sensitive data from context once client is initialized.
- `forceNewConnection` (optional): Creates new connection on every run and destroys it after. Database client needs to have `destroy` function in order to properly clean up connections.
- `awsSdkOptions` (optional): Will use to create an IAM RDS Auth Token for the database connection using `[RDS.Signer](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS/Signer.html)`. See AWs docs for required params, `region` is automatically pulled from the `hostname` unless overridden.

## Sample usage

Minimal configuration

```javascript
const handler = middy(async (event, context) => {
  const { db } = context;
  const records = await db.select('*').from('my_table');
  console.log(records);
});
handler.use(dbManager({
  config: {
    client: 'pg',
    connection: {
      host: '127.0.0.1',
      user: 'your_database_user',
      password: 'your_database_password',
      database: 'myapp_test'
    }
  },
}));
```

Credentials as secrets object

```javascript
const handler = middy(async (event, context) => {
  const { db } = context;
  const records = await db.select('*').from('my_table');
  console.log(records);
});
handler.use(secretsManager({
    secrets: {
        [secretsField]: 'my_db_credentials' // { user: 'your_database_user', password: 'your_database_password' }
    },
    throwOnFailedCall: true
}));
handler.use(dbManager({
  config: {
    client: 'pg',
    connection: {
      host : '127.0.0.1',
      database : 'myapp_test'
    }
  },
  secretsPath: secretsField
}));
```

Custom knex (or any other) client and secrets

```javascript
const knex = require('knex')

const handler = middy(async (event, context) => {
  const { db } = context;
  const records = await db.select('*').from('my_table');
  console.log(records);
});
handler.use(secretsManager({
    secrets: {
        [secretsField]: 'my_db_credentials' // { user: 'your_database_user', password: 'your_database_password' }
    },
    throwOnFailedCall: true
}));
handler.use(dbManager({
  client: knex,
  config: {
    client: 'pg',
    connection: {
      host : '127.0.0.1',
      database : 'myapp_test'
    }
  },
  secretsPath: secretsField
}));
```

Connect to RDS using IAM Auth Tokens and TLS

```javascript
const tls = require('tls')
const ca = require('fs').readFileSync(`${__dirname}/rds-ca-2019-root.pem`)  // Download from https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html

const handler = middy(async (event, context) => {
  const { db } = context;
  const records = await db.select('*').from('my_table');
  console.log(records);
});
handler.use(dbManager({
  rdsSigner:{
    region: 'us-east-1',
    hostname: '*****.******.{region}.rds.amazonaws.com',
    username: 'iam_user',
    database: 'myapp_test',
    port: '5432'
  },
  secretsPath: 'password',
  config: {
    client: 'pg',
    connection: {
      host: '*****.******.{region}.rds.amazonaws.com',
      user: 'your_database_user',
      database: 'myapp_test',
      port: '5432',
      ssl: {
        rejectUnauthorized: true,
        ca,
        checkServerIdentity: (host, cert) => {
          const error = tls.checkServerIdentity(host, cert)
          if (error && !cert.subject.CN.endsWith('.rds.amazonaws.com')) {
            return error
          }
        }
      }
    }
  }
}));
```

**Note:** If you see an error 

See AWS Docs [Rotating Your SSL/TLS Certificate](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL-certificate-rotation.html) to ensure you're using the right certificate.

## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2018 Luciano Mammino and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>

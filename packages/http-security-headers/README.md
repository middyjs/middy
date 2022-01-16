# Middy http-security-headers middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>HTTP security headers middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
  <p>Applies best practice security headers to responses. It's a simplified port of [HelmetJS](https://helmetjs.github.io/). See HelmetJS documentation for more details.</p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fhttp-security-headers">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-security-headers.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter"  style="max-width:100%;">
  </a>
</p>
</div>

Applies best practice security headers to responses. It's a simplified port of HelmetJS. See [HelmetJS](https://helmetjs.github.io/) documentation for more details.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-security-headers
```

## Options
Setting an option to `false` to cause that rule to be ignored.

### All Responses
- `originAgentCluster`: Default to `{}` to include
- `referrerPolicy`: Default to `{ policy: 'no-referrer' }`
- `strictTransportSecurity`: Default to `{ maxAge: 15552000, includeSubDomains: true, preload: true }`
- X-`dnsPrefetchControl`: Default to `{ allow: false }`
- X-`downloadOptions`: Default to `{ action: 'noopen' }`
- X-`poweredBy`: Default to `{ server: '' }` to remove `Server` and `X-Powered-By`
- X-`contentTypeOptions`: Default to `{ action: 'nosniff' }`
### HTML Responses
- `contentSecurityPolicy`: Default to `{ 'default-src': "'none'", 'base-uri':"'none'", 'sandbox':'', 'form-action':"'none'", 'frame-ancestors':"'none'", 'navigate-to':"'none'", 'report-to':'csp', 'require-trusted-types-for':"'script'", 'trusted-types':"'none'", 'upgrade-insecure-requests':'' }`
- `crossOriginEmbedderPolicy`: Default to `{ policy: 'require-corp' }`
- `crossOriginOpenerPolicy`: Default to `{ policy: 'same-origin' }`
- `crossOriginResourcePolicy`: Default to `{ policy: 'same-origin' }`
- `permissionsPolicy`: Default to `{ *:'', ... }` where all allowed values are set to disable
- `reportTo`: Defaults to `{ maxAge: 31536000, default: '', includeSubdomains: true, csp: '', staple:'', xss: '' }` which won't report by default, needs setting
- X-`frameOptions`: Default to `{ action: 'deny' }`
- X-`xssProtection`: Defaults to `{ reportUri: '' }'`


## Sample usage

```javascript
import middy from '@middy/core'
import httpSecurityHeaders from '@middy/http-security-headers'

const handler = middy((event, context) => {
  return {}
})

handler
  .use(httpSecurityHeaders())
```


## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2022 Luciano Mammino, will Farrell, and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>

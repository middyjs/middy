---
title: http-security-headers
description: "Apply security headers like HSTS, CSP, and X-Frame-Options to Lambda HTTP responses."
---

Applies best practice security headers to responses. It's a simplified port of HelmetJS. See [HelmetJS](https://helmetjs.github.io/) documentation for more details.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-security-headers
```

## Features
- `dnsPrefetchControl` controls browser DNS prefetching
- `frameOptions` to prevent clickjacking
- `poweredBy` to remove the Server/X-Powered-By header
- `strictTransportSecurity` for HTTP Strict Transport Security
- `downloadOptions` sets X-Download-Options for IE8+
- `contentTypeOptions` to keep clients from sniffing the MIME type
- `referrerPolicy` to hide the Referer header
- `xssProtection` sets `X-XSS-Protection: 0` to disable the legacy browser XSS filter

## Options

Every header option accepts `true` (use the defaults listed below), `false` (do not emit the header), or an object that is shallow-merged over the defaults. `contentSecurityPolicyReportOnly` and `poweredBy` are plain booleans.

- `contentSecurityPolicy` (object|boolean) (default `{ "default-src": "'report-sample' 'report-sha256'", "base-uri": "'none'", sandbox: "", "form-action": "'none'", "frame-ancestors": "'none'", "report-to": "default", "require-trusted-types-for": "'script'", "upgrade-insecure-requests": "" }`): Sets `Content-Security-Policy` from a map of directive name to source-list string, each emitted as `directive value` and joined with `; `. Directives with an empty value are dropped, except `sandbox` and `upgrade-insecure-requests`, which are emitted as bare tokens when set to `""`; pass `false` to skip the header.
- `contentSecurityPolicyReportOnly` (boolean) (default `false`): When `true`, the policy built from `contentSecurityPolicy` is sent as `Content-Security-Policy-Report-Only` instead of `Content-Security-Policy`. It has no effect when `contentSecurityPolicy` is `false`.
- `contentTypeOptions` (object|boolean) (default `{ action: "nosniff" }`): Sets `X-Content-Type-Options` to `action`. Pass `false` to skip the header.
- `crossOriginEmbedderPolicy` (object|boolean) (default `{ policy: "require-corp" }`): Sets `Cross-Origin-Embedder-Policy` to `policy`. Pass `false` to skip the header.
- `crossOriginOpenerPolicy` (object|boolean) (default `{ policy: "same-origin" }`): Sets `Cross-Origin-Opener-Policy` to `policy`. Pass `false` to skip the header.
- `crossOriginResourcePolicy` (object|boolean) (default `{ policy: "same-origin" }`): Sets `Cross-Origin-Resource-Policy` to `policy`. Pass `false` to skip the header.
- `dnsPrefetchControl` (object|boolean) (default `{ allow: false }`): Sets `X-DNS-Prefetch-Control` to `on` when `allow` is `true`, otherwise `off`. Pass `false` to skip the header.
- `downloadOptions` (object|boolean) (default `{ action: "noopen" }`): Sets `X-Download-Options` to `action`. Pass `false` to skip the header.
- `frameOptions` (object|boolean) (default `{ action: "deny" }`): Sets `X-Frame-Options` to `action` upper-cased, so the default emits `DENY`. Pass `false` to skip the header.
- `originAgentCluster` (object|boolean) (default `{}`): Sets `Origin-Agent-Cluster: ?1`. The object accepts no properties; pass `false` to skip the header.
- `permissionsPolicy` (object|boolean) (default `{ accelerometer: "", "all-screens-capture": "", "ambient-light-sensor": "", autoplay: "", battery: "", camera: "", "cross-origin-isolated": "", "display-capture": "", "document-domain": "", "encrypted-media": "", "execution-while-not-rendered": "", "execution-while-out-of-viewport": "", fullscreen: "", geolocation: "", gyroscope: "", "keyboard-map": "", magnetometer: "", microphone: "", midi: "", monetization: "", "navigation-override": "", payment: "", "picture-in-picture": "", "publickey-credentials-get": "", "screen-wake-lock": "", "sync-xhr": "", usb: "", "web-share": "", "xr-spatial-tracking": "", "clipboard-read": "", "clipboard-write": "", gamepad: "", "speaker-selection": "", "conversion-measurement": "", "focus-without-user-activation": "", hid: "", "idle-detection": "", "interest-cohort": "", serial: "", "sync-script": "", "trust-token-redemption": "", "window-placement": "", "vertical-scroll": "" }`): Sets `Permissions-Policy` from a map of feature name to allowlist string, each emitted as `feature=(value)`, or `feature=*` when the value is `"*"`. Every default feature is `""`, which emits `feature=()` and denies it for all origins; pass `false` to skip the header.
- `permittedCrossDomainPolicies` (object|boolean) (default `{ policy: "none" }`): Sets `X-Permitted-Cross-Domain-Policies` to `policy`, one of `none`, `master-only`, `by-content-type`, `by-ftp-filename` or `all`. Pass `false` to skip the header.
- `poweredBy` (boolean) (default `true`): When `true`, removes the `Server` and `X-Powered-By` headers from the response. Pass `false` to leave them in place.
- `referrerPolicy` (object|boolean) (default `{ policy: "no-referrer" }`): Sets `Referrer-Policy` to `policy`, one of `no-referrer`, `no-referrer-when-downgrade`, `origin`, `origin-when-cross-origin`, `same-origin`, `strict-origin`, `strict-origin-when-cross-origin` or `unsafe-url`. Pass `false` to skip the header.
- `reportingEndpoints` (object|boolean) (default `{}`): Sets `Reporting-Endpoints` from a map of endpoint name to URL, each emitted as `name="url"` and joined with `, `. The header is omitted while the map is empty, so nothing is sent by default; pass `false` to skip it entirely.
- `reportTo` (object|boolean) (default `{ maxAge: 31536000, includeSubDomains: true }`): Deprecated, use `reportingEndpoints` instead. Sets `Report-To` from the remaining keys, each an endpoint URL emitted as a JSON group named after its key with `max_age` from `maxAge` (the `default` group also carries `include_subdomains` from `includeSubDomains`; the legacy `includeSubdomains` casing is still accepted but deprecated); the header is omitted when no URL is set, so nothing is sent by default.
- `strictTransportSecurity` (object|boolean) (default `{ maxAge: 15552000, includeSubDomains: true, preload: true }`): Sets `Strict-Transport-Security` to `max-age=<maxAge>` (rounded to an integer, 180 days by default), appending `; includeSubDomains` when `includeSubDomains` is `true` and `; preload` when `preload` is `true` and `maxAge` is at least `31536000` (one year), so the default omits `preload`. Pass `false` to skip the header.
- `xssProtection` (object|boolean) (default `false`): When enabled, sets `X-XSS-Protection: 0` to turn off the legacy browser XSS filter. The object accepts no properties; the header is not sent by default.

## Sample usage

```javascript
import middy from '@middy/core'
import httpSecurityHeaders from '@middy/http-security-headers'

const lambdaHandler = (event, context) => {
  return {}
}

export const handler = middy().use(httpSecurityHeaders()).handler(lambdaHandler)
```

---
title: http-x402
description: "Gate Lambda HTTP endpoints behind x402 on-chain micropayments: verifies and settles v2 (PAYMENT-SIGNATURE) and v1 (X-PAYMENT) payments via a facilitator."
status: alpha
---

Implements the [x402 payment protocol](https://x402.org) for API Gateway and Function URL handlers, serving protocol v2 and v1 clients side by side (configurable via `versions`). The version is detected per request from the payment header: v2 clients send `PAYMENT-SIGNATURE`, v1 clients send `X-PAYMENT` (v2 wins when both are present). The middleware verifies the payment with a facilitator, runs the handler, then settles the payment on-chain. An unpaid 402 challenges both generations at once: the v2 challenge travels in the `PAYMENT-REQUIRED` header and the v1 challenge in the JSON body. Settlement results are returned in `PAYMENT-RESPONSE` (v2) or `X-PAYMENT-RESPONSE` (v1) on success and failure alike.

After settlement, payer info is available via `request.internal.x402` for downstream use (e.g. logging, rate-limiting per wallet).

> **Consider AWS WAF AI traffic monetization.** If you front your handler with Amazon CloudFront, AWS WAF can now return the x402 HTTP 402 challenge and verify payment at the edge, before requests reach Lambda, with no application code. This middleware remains the right fit when you need per-request pricing in handler logic, access to payer info during execution, or you are not on CloudFront. See [AWS WAF adds AI traffic monetization capability](https://aws.amazon.com/blogs/aws/aws-waf-adds-ai-traffic-monetization-capability-to-help-content-owners-charge-ai-bots-for-content-access/).

## Install

```bash npm2yarn
npm install --save @middy/http-x402 @x402/core
```

## Options

- `price` (number|string) (required unless `amount` is set): Amount to charge in human-readable units (e.g. `0.001` for $0.001 USDC).
- `amount` (string) (optional): Payment amount as an integer string in atomic token units. Takes precedence over `price` and `decimals`.
- `payTo` (string) (required): Wallet address that receives the payment.
- `asset` (string) (required): On-chain asset contract address (e.g. USDC on Base).
- `versions` (array of `1 | 2`) (default `[1, 2]`): Protocol versions to accept and advertise. A disabled version's payment header is ignored and the client is re-challenged with the enabled formats only, before any facilitator call. Pin `[2]` to reduce attack surface on new deployments. The default will drop `1` in the next major version; pass `versions: [1, 2]` explicitly if you need v1 long term.
- `FacilitatorClient` (class) (default `HTTPFacilitatorClient` from `@x402/core`): Facilitator client class. Override for custom facilitators.
- `facilitatorUrl` (string) (default `"https://x402.org/facilitator"`): URL of the x402 facilitator service.
- `decimals` (integer) (default `6`): Asset decimal places used to convert `price` to on-chain units.
- `network` (string) (default `"eip155:8453"`): CAIP-2 chain ID, used verbatim for both protocol versions (matching `@x402/core` 2.x). Default is Base mainnet.
- `description` (string) (default `""`): Human-readable description included in the payment requirements.
- `mimeType` (string) (default `"application/json"`): MIME type of the protected resource.
- `extra` (object) (optional): Scheme-specific data advertised in the payment requirements and sent to the facilitator, e.g. `{ name: 'USDC', version: '2' }` (the EIP-712 domain used by the `exact` scheme on EVM networks). The protocol-reserved keys `extra.paymentFlow` and `extra.assetTransferMethod` are rejected: only the authorization flow (verify before the handler, settle after) is implemented.
- `human` (function) (optional): `(request) => boolean`. Return `true` to bypass payment for this request (e.g. to let browser traffic through based on `User-Agent`).

## Sample usage

```javascript
import middy from '@middy/core'
import httpX402 from '@middy/http-x402'

export const handler = middy()
  .use(
    httpX402({
      price: 0.001,
      payTo: '0xYourWalletAddress',
      asset: '0xYourAssetAddress', // USDC on Base
    }),
  )
  .handler(async (event, context) => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Paid content' }),
    }
  })
```

### Bypass for browser traffic

```javascript
import middy from '@middy/core'
import httpX402 from '@middy/http-x402'

export const handler = middy()
  .use(
    httpX402({
      price: 0.001,
      payTo: '0xYourWalletAddress',
      asset: '0xYourAssetAddress',
      human: (request) => {
        const ua = request.event.headers?.['user-agent'] ?? ''
        return /Mozilla|Chrome|Safari/.test(ua)
      },
    }),
  )
  .handler(async (event, context) => {
    return { statusCode: 200, body: JSON.stringify({ message: 'Content' }) }
  })
```

### Harden to v2 only

Pinning `versions` shrinks the accepted protocol surface: v1 payment headers are ignored, agents are only ever challenged with v2 terms, and no facilitator call is spent on v1 traffic.

```javascript
import middy from '@middy/core'
import httpX402 from '@middy/http-x402'

export const handler = middy()
  .use(
    httpX402({
      price: 0.001,
      payTo: '0xYourWalletAddress',
      asset: '0xYourAssetAddress',
      versions: [2],
    }),
  )
  .handler(async (event, context) => {
    return { statusCode: 200, body: JSON.stringify({ message: 'Paid content' }) }
  })
```

## Responses

Per the v2 HTTP transport all protocol information is communicated through headers; v1 clients read the challenge from the 402 body instead. For requests recognized as v2 the JSON body mirrors the decoded `PAYMENT-REQUIRED` object. Advertisement follows the `versions` option: with `versions: [2]` the 402 body mirrors the v2 header instead of carrying a v1 challenge, and with `versions: [1]` the `PAYMENT-REQUIRED` header is omitted, so agents are only ever offered terms the server will accept.

| Outcome | Status | Where the protocol object lands |
| --- | --- | --- |
| No payment header | 402 | v2 challenge in `PAYMENT-REQUIRED`, v1 challenge in the body |
| Undecodable payment, unsupported `x402Version`, requirements mismatch, or verification failure (v2 request) | 402 | `PAYMENT-REQUIRED` with `error` set |
| Undecodable payment, unsupported `x402Version`, requirements mismatch, or verification failure (v1 request) | 402 | v1 challenge in the body with `error` set |
| Settlement failure | 402 | `PAYMENT-RESPONSE` (v2) or `X-PAYMENT-RESPONSE` (v1) with `success: false` and `errorReason` |
| Payment settled | handler's status | `PAYMENT-RESPONSE` (v2) or `X-PAYMENT-RESPONSE` (v1) with the settlement result |

## Internal storage

After a successful payment, the middleware stores settlement details in `request.internal.x402`:

- `payload`: Decoded payment header (its `x402Version` tells you which protocol version paid)
- `requirements`: Canonical payment requirements used for verification and settlement (v2 `PaymentRequirements`, or v1 `PaymentRequirementsV1` with `maxAmountRequired`). The v2 object is frozen: it is shared across warm invocations, so treat it as read-only.
- `payer`: Wallet address of the payer (available after settlement)
- `transaction`: Settlement transaction hash
- `network`: Chain ID of the settlement

## Bundling

Add `@x402/core` to your bundler's external list if you include it as a Lambda layer, otherwise bundle it with your handler.

---
title: http-x402
description: "Gate Lambda HTTP endpoints behind x402 on-chain micropayments — verifies and settles payment-signature headers via a facilitator."
status: alpha
---

Implements the [x402 payment protocol](https://x402.org) for API Gateway and Function URL handlers. On each request the middleware checks the `payment-signature` header, verifies it with a facilitator, runs the handler, then settles the payment on-chain. Returns HTTP 402 with payment requirements when no valid payment header is present.

After settlement, payer info is available via `request.internal.x402` for downstream use (e.g. logging, rate-limiting per wallet).

> **Consider AWS WAF AI traffic monetization.** If you front your handler with Amazon CloudFront, AWS WAF can now return the x402 HTTP 402 challenge and verify payment at the edge, before requests reach Lambda, with no application code. This middleware remains the right fit when you need per-request pricing in handler logic, access to payer info during execution, or you are not on CloudFront. See [AWS WAF adds AI traffic monetization capability](https://aws.amazon.com/blogs/aws/aws-waf-adds-ai-traffic-monetization-capability-to-help-content-owners-charge-ai-bots-for-content-access/).

## Install

```bash npm2yarn
npm install --save @middy/http-x402 @x402/core
```

## Options

- `price` (number) (required): Amount to charge in human-readable units (e.g. `0.001` for $0.001 USDC).
- `payTo` (string) (required): Wallet address that receives the payment.
- `asset` (string) (required): On-chain asset contract address (e.g. USDC on Base).
- `FacilitatorClient` (class) (default `HTTPFacilitatorClient` from `@x402/core`): Facilitator client class. Override for custom facilitators.
- `facilitatorUrl` (string) (default `"https://x402.org/facilitator"`): URL of the x402 facilitator service.
- `decimals` (integer) (default `6`): Asset decimal places used to convert `price` to on-chain units.
- `network` (string) (default `"eip155:8453"`): CAIP-2 chain ID. Default is Base mainnet.
- `description` (string) (default `""`): Human-readable description included in the payment requirements.
- `mimeType` (string) (default `"application/json"`): MIME type of the protected resource.
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

## Internal storage

After a successful payment, the middleware stores settlement details in `request.internal.x402`:

- `payload`: Decoded payment header
- `requirements`: Full payment requirements used for verification
- `payer`: Wallet address of the payer (available after settlement)
- `transaction`: Settlement transaction hash
- `network`: Chain ID of the settlement

## Bundling

Add `@x402/core` to your bundler's external list if you include it as a Lambda layer, otherwise bundle it with your handler.

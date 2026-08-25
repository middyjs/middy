# Runtime Dependency Inventory

Every runtime dependency shipped by a published `@middy/*` package, with its justification. This is the recorded inventory required by SPVS 1.6 V2.2.4; it is reviewed quarterly per [GOVERNANCE.md](GOVERNANCE.md) and must be updated in the same PR that adds or removes a runtime dependency.

Snapshot: 55 published packages; 54 have `@middy/util` as their only runtime dependency (or none). Transitive depth is one level except where noted.

## First-party

| Dependency | Used by | Justification |
| --- | --- | --- |
| `@middy/util` | 54 packages | Shared internal helpers; kept dependency-free by policy |
| `@middy/event-batch-response` | `@middy/event-batch-handler` | First-party split package |

## Third-party

| Dependency | Used by | Justification |
| --- | --- | --- |
| `ajv`, `ajv-errors`, `ajv-formats`, `ajv-keywords`, `@silverbucket/ajv-formats-draft2019`, `ajv-ftl-i18n` | `@middy/validator` | JSON Schema validation engine plus official/format plugins; spec-compliant validation is not worth reimplementing |
| `@fastify/busboy` | `@middy/http-multipart-body-parser` | Multipart stream parsing; maintained by the Fastify org |
| `aws-embedded-metrics` | `@middy/cloudwatch-metrics` | AWS's own Embedded Metric Format client |
| `json-mask` | `@middy/http-partial-response` | Field-mask grammar parser (Google partial-response syntax) |
| `negotiator` | `@middy/http-content-negotiation` | RFC 9110 content negotiation; the same library Express uses |

## Peer dependencies

Peer dependencies (AWS SDK v3 clients, `pg`, `kafkajs`, `jose`, and similar) are deliberately not runtime dependencies: the consumer chooses and pins them in their own tree, keeping middy packages install-light and letting the Lambda-provided SDK be used where available.

## Adding a dependency

Per the [OSS Component Policy](../SECURITY.md#oss-component-policy): a new runtime dependency requires maintainer review covering exact-name verification (typosquat check against the intended repository), install scripts, maintainer count, publication age, license, and a justification row added to this file in the same PR.

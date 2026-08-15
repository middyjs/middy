# middy e2e event capture harness

Captures the real event JSON every AWS service delivers to Lambda, across all
documented invocation paths and the configuration permutations that change the
event structure. Design + full event matrix with AWS doc references:
[SPEC.md](./SPEC.md). Coverage contract: [manifest.json](./manifest.json).

Nothing here runs in CI. Deploys are manual, ephemeral, and cost real (small)
money while up.

## Runbook

```bash
export AWS_PROFILE=your-profile   # required
# AWS_REGION defaults to us-east-1 (required for --edge and --ses-domain)

npm install
npm run selfcheck                  # offline gate: parses the template, executes
                                   # every inline handler in a sandbox, checks
                                   # contracts + kind coverage. Run after edits.

./deploy.sh                        # tier 0 only (~free idle, deploys in minutes)
node trigger.mjs all               # fire every enabled kind, poll for captures
node collect.mjs                   # write fixtures/<kind>.json + coverage matrix
./destroy.sh
```

Review `fixtures/` diffs before committing: sanitization (account ids, IPs,
UUIDs, timestamps, tokens) is regex-based, not a guarantee.

## Tiers

| flag | adds | notes |
| --- | --- | --- |
| (none) | everything pay-per-use: SQS/SNS/S3/DynamoDB/Kinesis/Firehose, API GW REST+HTTP+WS, Function URLs, Cognito, EventBridge (+Scheduler/Pipes), CW Logs/Alarm, IoT, Secrets, Step Functions, AppSync, Lex, S3 Batch/Object Lambda, CodePipeline, CFN custom resource, destinations/DLQ | Kinesis shard + Lex are the only metered-while-idle items (cents/day) |
| `--vpc` | VPC, ALB (single + multi-value-headers), VPC Lattice (V1 + V2), in-VPC trigger proxy | ALB is billed hourly while deployed |
| `--brokers` | MSK 3.9.x (SASL/SCRAM + IAM), self-managed-Kafka ESM (same cluster), ActiveMQ, RabbitMQ, DocumentDB, 3 PrivateLink endpoints (lambda/sts/secretsmanager, required by the pollers in this NAT-less VPC) | implies `--vpc`; all hourly; MSK takes 20-35 min to create; runs `npm run build:broker-writer` |
| `--edge` | CloudFront + 4 Lambda@Edge triggers | us-east-1 only; stack delete stalls until replicas purge (rerun destroy.sh later) |
| `--ses-domain=… --hosted-zone-id=…` | SES receiving (DKIM + MX records, receipt rule) | us-east-1; activates the receipt rule set account-wide (deploy.sh does it, destroy.sh reverts) |
| `--config` | Config recorder + custom rule | recorder is an account singleton: do NOT enable in an account already running AWS Config |
| `--cloudtrail` | management-events trail + CloudTrail EventBridge rule | trail is metered; events lag up to ~15 min |
| `--codecommit` | repo + push trigger | only in accounts grandfathered into CodeCommit |
| `--bedrock` | Bedrock agent with API-schema + function-schema action groups | requires model access (default model: Claude 3.5 Haiku); the only model-driven, non-deterministic trigger |
| `--transfer` | Transfer Family SFTP server with Lambda custom identity provider | server billed hourly (~5 min create); triggered via TestIdentityProvider, no SFTP client needed |

## Caveats

- `cfn.custom-resource` captures Create at deploy time; bump the
  `CaptureSerial` parameter and redeploy for Update; Delete is captured during
  destroy (visible in logs only until teardown finishes, so grab it with
  `node collect.mjs` before the log group is deleted if you need it).
- `eventbridge.ec2-state` is manual: `node trigger.mjs eventbridge.ec2-state
  --ec2-instance-id=i-…` stops a sacrificial instance you provide.
- `kafka.self-managed`: the ESM is created by trigger.mjs (bootstrap brokers
  are not resolvable in CloudFormation) and removed by destroy.sh.
- `secrets.rotation` intentionally never completes rotation; the secret is
  purged by destroy.sh. `config.rule` evaluations report as failed (the
  capture returns no PutEvaluations); the event is still captured.
- Lambda@Edge logs land in the region of the CloudFront POP that served you.
  `EDGE_REGIONS` (comma-separated, default `$AWS_REGION,us-east-1,ca-central-1,us-west-2`)
  controls where trigger/collect/destroy look.
- `mq.rabbitmq`: the ESM sits in a problem state until trigger.mjs declares the
  queue on first run; Lambda's poller recovers on its own within a few minutes.
  The broker stays on RabbitMQ 3.13: 4.x requires mq.m7g instance types.
- `codepipeline.job`: the pipeline auto-runs once at creation and fails its
  Source stage (no source.zip yet); expected until the first trigger run.
- `--ses-domain` activates this stack's receipt rule set account-wide; skip it
  if the account already uses SES receiving (destroy.sh deactivates without
  restoring a previous set).
- SES domain verification (DKIM CNAMEs) can take minutes after first deploy;
  a `ses.receipt` timeout on run one usually just means DNS has not propagated.
- First `--config` deploy: confirm the recorder is recording
  (`aws configservice describe-configuration-recorder-status`); start it
  manually if CloudFormation created it stopped.
- Deploys use an `middy-events-deploy-<account>` bootstrap bucket (template is
  over the 51,200-byte direct-upload limit); destroy.sh keeps it.
- Fixture payloads stay small on purpose: capture transport is CloudWatch Logs
  and lines truncate at 256 KB.

## Phase 2

`fixtures/` feeds the JSON Schema authoring pass (`schemas/<kind>.json`),
cross-checked against the EventBridge schema registry and `@types/aws-lambda`.
The fixture wins on conflict. See SPEC.md "Phase 2 hook".

#!/usr/bin/env bash
# Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
# SPDX-License-Identifier: MIT
# Tear down the middy e2e event capture harness.
# Assumes AWS_PROFILE is set. AWS_REGION defaults to us-east-1.
set -euo pipefail
cd "$(dirname "$0")"

export AWS_REGION="${AWS_REGION:-us-east-1}"
STACK="${STACK_NAME:-middy-events}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"

out() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text 2>/dev/null || true
}

# self-managed kafka ESM was created by trigger.mjs, not the stack
KAFKA_FN="$(out KafkaSelfFunctionArn)"
if [ -n "$KAFKA_FN" ] && [ "$KAFKA_FN" != "None" ]; then
  for uuid in $(aws lambda list-event-source-mappings --function-name "$KAFKA_FN" \
      --query 'EventSourceMappings[].UUID' --output text); do
    echo "deleting self-managed kafka ESM ${uuid}"
    aws lambda delete-event-source-mapping --uuid "$uuid" || true
  done
fi

# deactivate SES receipt rule set if this stack's set is active
RULESET="$(out SesRuleSetName)"
if [ -n "$RULESET" ] && [ "$RULESET" != "None" ]; then
  ACTIVE="$(aws ses describe-active-receipt-rule-set --query 'Metadata.Name' --output text 2>/dev/null || true)"
  if [ "$ACTIVE" = "$RULESET" ]; then
    aws ses set-active-receipt-rule-set
    echo "deactivated SES receipt rule set"
  fi
fi

# buckets must be empty before delete
for key in MainBucketName VersionedBucketName; do
  B="$(out "$key")"
  if [ -n "$B" ] && [ "$B" != "None" ]; then
    echo "emptying s3://${B}"
    aws s3 rm --recursive --quiet "s3://${B}" || true
    # versioned bucket: also purge versions + delete markers
    aws s3api list-object-versions --bucket "$B" \
      --query '{v: Versions[].{Key:Key,VersionId:VersionId}, d: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
      --output json 2>/dev/null |
      python3 -c '
import json, subprocess, sys
d = json.load(sys.stdin)
objs = (d.get("v") or []) + (d.get("d") or [])
for i in range(0, len(objs), 500):
    batch = {"Objects": objs[i:i+500], "Quiet": True}
    subprocess.run(["aws", "s3api", "delete-objects", "--bucket", sys.argv[1],
                    "--delete", json.dumps(batch)], check=False)
' "$B" || true
  fi
done
TRAIL_BUCKET="${STACK}-trail-${ACCOUNT}"
aws s3 rm --recursive --quiet "s3://${TRAIL_BUCKET}" 2>/dev/null || true

# the cfn.macro probe stack is created by trigger.mjs, not the main stack
aws cloudformation delete-stack --stack-name "${STACK}-macro-probe" 2>/dev/null || true

echo "deleting stack ${STACK}..."
aws cloudformation delete-stack --stack-name "$STACK"
if ! aws cloudformation wait stack-delete-complete --stack-name "$STACK"; then
  cat >&2 <<'MSG'
Stack delete did not complete. If the failures are the Lambda@Edge functions,
CloudFront replicas take a few hours to purge; re-run this script later and
the delete will succeed.
MSG
  exit 1
fi

# CloudFormation schedules secret deletion with a recovery window, which
# blocks a same-name redeploy; purge them.
for secret in "${STACK}/rotation" "AmazonMSK_${STACK}" "${STACK}/mq-creds" "${STACK}/docdb"; do
  aws secretsmanager delete-secret --secret-id "$secret" \
    --force-delete-without-recovery >/dev/null 2>&1 || true
done

# Lambda@Edge log groups are auto-created in execution regions and are not
# stack-owned
for region in $(echo "${EDGE_REGIONS:-us-east-1 ca-central-1 us-west-2}" | tr ',' ' '); do
  for lg in $(aws logs describe-log-groups --region "$region" \
      --log-group-name-prefix "/aws/lambda/us-east-1.${STACK}-edge-" \
      --query 'logGroups[].logGroupName' --output text 2>/dev/null); do
    aws logs delete-log-group --region "$region" --log-group-name "$lg" || true
  done
done

echo "destroyed. (deploy bucket middy-events-deploy-${ACCOUNT} is kept)"

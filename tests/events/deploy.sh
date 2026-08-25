#!/usr/bin/env bash
# Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
# SPDX-License-Identifier: MIT
# Deploy the middy e2e event capture harness. See SPEC.md and README.md.
# Assumes AWS_PROFILE is set. AWS_REGION defaults to us-east-1.
#
# Usage:
#   ./deploy.sh [--vpc] [--brokers] [--edge] [--config] [--cloudtrail]
#               [--codecommit] [--bedrock] [--transfer]
#               [--ses-domain=events.example.com --hosted-zone-id=Z123]
set -euo pipefail
cd "$(dirname "$0")"

export AWS_REGION="${AWS_REGION:-us-east-1}"
STACK="${STACK_NAME:-middy-events}"

VPC=false BROKERS=false EDGE=false CONFIG=false TRAIL=false CODECOMMIT=false BEDROCK=false TRANSFER=false
SES_DOMAIN="" HOSTED_ZONE_ID=""
for arg in "$@"; do
  case "$arg" in
    --vpc) VPC=true ;;
    --brokers) BROKERS=true; VPC=true ;;
    --edge) EDGE=true ;;
    --config) CONFIG=true ;;
    --cloudtrail) TRAIL=true ;;
    --codecommit) CODECOMMIT=true ;;
    --bedrock) BEDROCK=true ;;
    --transfer) TRANSFER=true ;;
    --ses-domain=*) SES_DOMAIN="${arg#*=}" ;;
    --hosted-zone-id=*) HOSTED_ZONE_ID="${arg#*=}" ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

if { [ "$EDGE" = true ] || [ -n "$SES_DOMAIN" ]; } && [ "$AWS_REGION" != "us-east-1" ]; then
  echo "Lambda@Edge and SES receiving require AWS_REGION=us-east-1" >&2
  exit 1
fi
if [ -n "$SES_DOMAIN" ] && [ -z "$HOSTED_ZONE_ID" ]; then
  echo "--ses-domain requires --hosted-zone-id" >&2
  exit 1
fi

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BOOT="middy-events-deploy-${ACCOUNT}"
aws s3api head-bucket --bucket "$BOOT" 2>/dev/null || aws s3 mb "s3://${BOOT}"

WRITER_PARAMS=()
if [ "$BROKERS" = true ]; then
  echo "building triggers/broker-writer..."
  [ -d node_modules ] || npm ci --ignore-scripts
  npm run --silent build:broker-writer
  (cd triggers/broker-writer/dist && zip -q -X -o broker-writer.zip index.js)
  HASH="$(shasum -a 256 triggers/broker-writer/dist/broker-writer.zip | cut -c1-16)"
  KEY="broker-writer-${HASH}.zip"
  aws s3 cp --quiet "triggers/broker-writer/dist/broker-writer.zip" "s3://${BOOT}/${KEY}"
  WRITER_PARAMS=("BrokerWriterCodeBucket=${BOOT}" "BrokerWriterCodeKey=${KEY}")
fi

echo "deploying ${STACK} to ${AWS_REGION}..."
aws cloudformation deploy \
  --stack-name "$STACK" \
  --template-file template.yaml \
  --s3-bucket "$BOOT" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "EnableVpc=${VPC}" \
    "EnableBrokers=${BROKERS}" \
    "EnableEdge=${EDGE}" \
    "EnableConfig=${CONFIG}" \
    "EnableCloudTrail=${TRAIL}" \
    "EnableCodeCommit=${CODECOMMIT}" \
    "EnableBedrock=${BEDROCK}" \
    "EnableTransfer=${TRANSFER}" \
    "SesDomain=${SES_DOMAIN}" \
    "HostedZoneId=${HOSTED_ZONE_ID}" \
    ${WRITER_PARAMS[@]+"${WRITER_PARAMS[@]}"}

if [ -n "$SES_DOMAIN" ]; then
  # Receipt rule set activation has no CloudFormation support
  RULESET="$(aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='SesRuleSetName'].OutputValue" --output text)"
  aws ses set-active-receipt-rule-set --rule-set-name "$RULESET"
  echo "activated SES receipt rule set: ${RULESET}"
fi

echo "done. next: node trigger.mjs all && node collect.mjs"

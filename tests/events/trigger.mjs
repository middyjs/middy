#!/usr/bin/env node
/*
Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
SPDX-License-Identifier: MIT
*/
// Fires real AWS actions so every deployed event kind is delivered to its
// capture Lambda, then polls the capture log group until all expected kinds
// report (or their manifest timeout passes). See SPEC.md.
//
// Usage:
//   node trigger.mjs all
//   node trigger.mjs sqs.standard s3.put ...
//   node trigger.mjs all --no-wait
//   node trigger.mjs eventbridge.ec2-state --ec2-instance-id=i-0123
//
// Assumes AWS_PROFILE is set; AWS_REGION defaults to us-east-1.
process.env.AWS_REGION ??= "us-east-1";

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Sha256 } from "@aws-crypto/sha256-js";
import { BedrockAgentRuntime } from "@aws-sdk/client-bedrock-agent-runtime";
import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { CloudWatch } from "@aws-sdk/client-cloudwatch";
import { CloudWatchLogs } from "@aws-sdk/client-cloudwatch-logs";
import { CodeCommit } from "@aws-sdk/client-codecommit";
import { CodePipeline } from "@aws-sdk/client-codepipeline";
import { CognitoIdentityProvider } from "@aws-sdk/client-cognito-identity-provider";
import { ConfigService } from "@aws-sdk/client-config-service";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { EC2 } from "@aws-sdk/client-ec2";
import { EventBridge } from "@aws-sdk/client-eventbridge";
import { Firehose } from "@aws-sdk/client-firehose";
import { IoT } from "@aws-sdk/client-iot";
import { IoTDataPlane } from "@aws-sdk/client-iot-data-plane";
import { Kafka } from "@aws-sdk/client-kafka";
import { Kinesis } from "@aws-sdk/client-kinesis";
import { Lambda } from "@aws-sdk/client-lambda";
import { LexRuntimeV2 } from "@aws-sdk/client-lex-runtime-v2";
import { Mq } from "@aws-sdk/client-mq";
import { S3 } from "@aws-sdk/client-s3";
import { S3Control } from "@aws-sdk/client-s3-control";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";
import { SESv2 } from "@aws-sdk/client-sesv2";
import { SFN } from "@aws-sdk/client-sfn";
import { SNS } from "@aws-sdk/client-sns";
import { SQS } from "@aws-sdk/client-sqs";
import { STS } from "@aws-sdk/client-sts";
import { Transfer } from "@aws-sdk/client-transfer";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@smithy/signature-v4";

const STACK = process.env.STACK_NAME ?? "middy-events";
const REGION = process.env.AWS_REGION;
const EDGE_REGIONS = (
	process.env.EDGE_REGIONS ?? `${REGION},us-east-1,ca-central-1,us-west-2`
)
	.split(",")
	.filter((v, i, a) => a.indexOf(v) === i);
const manifest = JSON.parse(
	readFileSync(new URL("./manifest.json", import.meta.url), "utf8"),
).kinds;

const args = process.argv.slice(2);
const flags = Object.fromEntries(
	args
		.filter((a) => a.startsWith("--"))
		.map((a) => a.replace(/^--/, "").split("=")),
);
const requested = args.filter((a) => !a.startsWith("--"));
if (!requested.length) {
	console.error("usage: node trigger.mjs <kind ...|all> [--no-wait]");
	process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);

// --- stack outputs ---------------------------------------------------------
const cfn = new CloudFormation({});
const { Stacks } = await cfn.describeStacks({ StackName: STACK });
const out = Object.fromEntries(
	(Stacks[0].Outputs ?? []).map((o) => [o.OutputKey, o.OutputValue]),
);
const { Account: account } = await new STS({}).getCallerIdentity({});

// --- trigger units: one unit may produce several kinds ---------------------
const proxyInvoke = async (payload) => {
	const lambda = new Lambda({});
	const res = await lambda.invoke({
		FunctionName: out.ProxyFunctionName,
		Payload: JSON.stringify(payload),
	});
	const body = JSON.parse(Buffer.from(res.Payload).toString());
	if (res.FunctionError) throw new Error(`proxy: ${JSON.stringify(body)}`);
	return body;
};

const mqAuth = `Basic ${Buffer.from(`middy:middyevents-${account}`).toString("base64")}`;

// SHA-256 of an empty body; Lambda function URLs expect the payload hash
// header on signed requests
const EMPTY_SHA256 =
	"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const signedFetch = async (url, service = "lambda") => {
	const u = new URL(url);
	const signer = new SignatureV4({
		service,
		region: REGION,
		credentials: fromNodeProviderChain(),
		sha256: Sha256,
	});
	const signed = await signer.sign({
		method: "GET",
		protocol: u.protocol,
		hostname: u.hostname,
		path: u.pathname,
		headers: { host: u.hostname, "x-amz-content-sha256": EMPTY_SHA256 },
	});
	return fetch(url, { headers: signed.headers });
};

const ddbItem = {
	pk: { S: "capture" },
	str: { S: "text" },
	num: { N: "42.5" },
	big: { N: "9007199254740993" },
	bool: { BOOL: true },
	nil: { NULL: true },
	bin: { B: Buffer.from([1, 2, 3]) },
	list: { L: [{ S: "a" }, { N: "1" }] },
	map: { M: { nested: { S: "value" } } },
	sset: { SS: ["a", "b"] },
	nset: { NS: ["1", "2"] },
	bset: { BS: [Buffer.from([1]), Buffer.from([2])] },
};
const ddbCycle = async (table) => {
	const ddb = new DynamoDB({});
	await ddb.putItem({ TableName: table, Item: ddbItem });
	await ddb.updateItem({
		TableName: table,
		Key: { pk: { S: "capture" } },
		UpdateExpression: "SET num = :n",
		ExpressionAttributeValues: { ":n": { N: "43" } },
	});
	await ddb.deleteItem({ TableName: table, Key: { pk: { S: "capture" } } });
};

const cognitoFlow = async () => {
	const idp = new CognitoIdentityProvider({});
	const ClientId = out.UserPoolClientId;
	const UserPoolId = out.UserPoolId;
	const password = `Capture-${randomUUID()}`;
	const userA = "middy-a@example.com";
	const userB = "middy-b@example.com";
	for (const u of [userA, userB]) {
		await idp.adminDeleteUser({ UserPoolId, Username: u }).catch(() => {});
	}
	// pre-signup (auto-confirm/verify) + post-confirmation
	await idp.signUp({
		ClientId,
		Username: userA,
		Password: password,
		UserAttributes: [{ Name: "email", Value: userA }],
	});
	// pre-auth, post-auth, pre-token (+ tokens for the JWT kind)
	const auth = await idp.initiateAuth({
		ClientId,
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: { USERNAME: userA, PASSWORD: password },
	});
	// custom-message (forgot-password verification code)
	await idp.forgotPassword({ ClientId, Username: userA }).catch((err) => {
		log("cognito forgotPassword:", err.name);
	});
	// define/create/verify auth challenge
	const custom = await idp.initiateAuth({
		ClientId,
		AuthFlow: "CUSTOM_AUTH",
		AuthParameters: { USERNAME: userA },
	});
	if (custom.ChallengeName === "CUSTOM_CHALLENGE") {
		await idp.respondToAuthChallenge({
			ClientId,
			ChallengeName: "CUSTOM_CHALLENGE",
			Session: custom.Session,
			ChallengeResponses: { USERNAME: userA, ANSWER: "42" },
		});
	}
	// user-migration (unknown user)
	await idp
		.initiateAuth({
			ClientId,
			AuthFlow: "USER_PASSWORD_AUTH",
			AuthParameters: { USERNAME: userB, PASSWORD: password },
		})
		.catch((err) => {
			log("cognito migration auth:", err.name);
		});
	return auth.AuthenticationResult?.IdToken;
};

let idToken; // set by the cognito unit, used by apigw.http.v2-jwt

const UNITS = [
	{
		kinds: ["sqs.standard"],
		run: async () => {
			await new SQS({}).sendMessage({
				QueueUrl: out.SqsStandardQueueUrl,
				MessageBody: JSON.stringify({ hello: "sqs", nested: { n: 1 } }),
				MessageAttributes: {
					attr: { DataType: "String", StringValue: "value" },
					num: { DataType: "Number", StringValue: "7" },
				},
			});
		},
	},
	{
		kinds: ["sqs.fifo"],
		run: async () => {
			await new SQS({}).sendMessage({
				QueueUrl: out.SqsFifoQueueUrl,
				MessageBody: JSON.stringify({ hello: "fifo" }),
				MessageGroupId: "g1",
				// content-based dedup would swallow identical re-runs for 5 min
				MessageDeduplicationId: randomUUID(),
			});
		},
	},
	{
		kinds: ["sns.standard", "sqs.sns", "sqs.sns-raw"],
		run: async () => {
			await new SNS({}).publish({
				TopicArn: out.SnsTopicArn,
				Message: JSON.stringify({ hello: "sns", nested: { n: 1 } }),
				Subject: "capture",
				MessageAttributes: {
					attr: { DataType: "String", StringValue: "value" },
				},
			});
		},
	},
	{
		kinds: [
			"s3.put",
			"s3.delete",
			"s3.delete-marker",
			"s3.sns",
			"s3.sns-sqs",
			"s3.sqs",
			"s3.eventbridge",
		],
		run: async () => {
			const s3 = new S3({});
			const Bucket = out.MainBucketName;
			// space + unicode key proves the URL-encoding contract
			await s3.putObject({
				Bucket,
				Key: "put/hello world ü.json",
				Body: '{"ok":true}',
				ContentType: "application/json",
			});
			await s3.putObject({ Bucket, Key: "delete/x.txt", Body: "x" });
			await s3.deleteObject({ Bucket, Key: "delete/x.txt" });
			await s3.putObject({ Bucket, Key: "sns/x.txt", Body: "x" });
			await s3.putObject({ Bucket, Key: "sqs/x.txt", Body: "x" });
			await s3.putObject({ Bucket, Key: "eb/x.txt", Body: "x" });
			const vb = out.VersionedBucketName;
			await s3.putObject({ Bucket: vb, Key: "dm/x.txt", Body: "x" });
			await s3.deleteObject({ Bucket: vb, Key: "dm/x.txt" });
		},
	},
	{
		kinds: ["s3batch.v1"],
		run: async () => {
			const s3 = new S3({});
			const Bucket = out.MainBucketName;
			await s3.putObject({ Bucket, Key: "batch/target.txt", Body: "x" });
			const manifestBody = `${Bucket},batch/target.txt\n`;
			const put = await s3.putObject({
				Bucket,
				Key: "batch/manifest.csv",
				Body: manifestBody,
			});
			const etag = put.ETag.replaceAll('"', "");
			await new S3Control({}).createJob({
				AccountId: account,
				ConfirmationRequired: false,
				ClientRequestToken: randomUUID(),
				Priority: 1,
				RoleArn: out.S3BatchRoleArn,
				Operation: {
					LambdaInvoke: { FunctionArn: out.FnS3BatchArn },
				},
				Report: { Enabled: false },
				Manifest: {
					Spec: {
						Format: "S3BatchOperations_CSV_20180820",
						Fields: ["Bucket", "Key"],
					},
					Location: {
						ObjectArn: `arn:aws:s3:::${Bucket}/batch/manifest.csv`,
						ETag: etag,
					},
				},
			});
		},
	},
	{
		kinds: ["s3object.get"],
		run: async () => {
			const s3 = new S3({});
			await s3.putObject({
				Bucket: out.MainBucketName,
				Key: "olap/x.txt",
				Body: "x",
			});
			const res = await s3.getObject({
				Bucket: out.ObjectLambdaAccessPointArn,
				Key: "olap/x.txt",
			});
			await res.Body.transformToString();
		},
	},
	{
		kinds: ["ddb.keys-only"],
		run: () => ddbCycle(`${STACK}-keys-only`),
	},
	{ kinds: ["ddb.new-image"], run: () => ddbCycle(`${STACK}-new-image`) },
	{ kinds: ["ddb.old-image"], run: () => ddbCycle(`${STACK}-old-image`) },
	{
		kinds: ["ddb.new-and-old"],
		run: () => ddbCycle(`${STACK}-new-and-old`),
	},
	{ kinds: ["ddb.windowed"], run: () => ddbCycle(`${STACK}-windowed`) },
	{
		kinds: ["kinesis.standard", "kinesis.efo", "kinesis.windowed"],
		run: async () => {
			const kin = new Kinesis({});
			await kin.putRecord({
				StreamName: out.KinesisStreamName,
				PartitionKey: "capture",
				Data: Buffer.from(JSON.stringify({ hello: "kinesis" })),
			});
			await kin.putRecord({
				StreamName: out.KinesisStreamName,
				PartitionKey: "capture",
				Data: Buffer.from("plain text payload"),
			});
		},
	},
	{
		kinds: ["firehose.transform"],
		run: async () => {
			await new Firehose({}).putRecord({
				DeliveryStreamName: out.FirehoseStreamName,
				Record: {
					Data: Buffer.from(`${JSON.stringify({ hello: "firehose" })}\n`),
				},
			});
		},
	},
	{
		kinds: ["cwlogs.subscription"],
		run: async () => {
			const logs = new CloudWatchLogs({});
			const stream = `capture-${Date.now()}`;
			await logs.createLogStream({
				logGroupName: out.FeederLogGroupName,
				logStreamName: stream,
			});
			await logs.putLogEvents({
				logGroupName: out.FeederLogGroupName,
				logStreamName: stream,
				logEvents: [
					{ timestamp: Date.now(), message: "middy capture line one" },
					{
						timestamp: Date.now(),
						message: JSON.stringify({ structured: true }),
					},
				],
			});
		},
	},
	{
		kinds: ["cwalarm.direct"],
		run: async () => {
			await new CloudWatch({}).setAlarmState({
				AlarmName: out.AlarmName,
				StateValue: "ALARM",
				StateReason: "middy-events trigger",
			});
		},
	},
	{
		kinds: ["eventbridge.schedule-rule", "eventbridge.scheduler"],
		run: async () => {
			log("eventbridge schedule kinds fire on their own (rate 1 minute)");
		},
	},
	{
		kinds: ["eventbridge.custom"],
		run: async () => {
			await new EventBridge({}).putEvents({
				Entries: [
					{
						EventBusName: out.EventBusName,
						Source: "middy.events",
						DetailType: "capture",
						Detail: JSON.stringify({ nested: { key: "value" } }),
					},
				],
			});
		},
	},
	{
		kinds: ["eventbridge.pipe-sqs"],
		run: async () => {
			await new SQS({}).sendMessage({
				QueueUrl: out.PipeSourceQueueUrl,
				MessageBody: JSON.stringify({ hello: "pipe" }),
			});
		},
	},
	{
		kinds: ["eventbridge.cloudtrail"],
		requires: "TrailReady",
		run: async () => {
			await new S3({}).putBucketTagging({
				Bucket: out.MainBucketName,
				Tagging: {
					TagSet: [{ Key: "middy", Value: `capture-${Date.now()}` }],
				},
			});
		},
	},
	{
		kinds: ["eventbridge.ec2-state"],
		run: async () => {
			const id = flags["ec2-instance-id"];
			if (!id) {
				log(
					"eventbridge.ec2-state: pass --ec2-instance-id to trigger; skipping",
				);
				return "manual-skip";
			}
			const ec2 = new EC2({});
			await ec2.stopInstances({ InstanceIds: [id] });
			// the stopping/stopped state-change events fire the capture; put the
			// instance back the way we found it
			for (let i = 0; i < 30; i++) {
				await sleep(10_000);
				const { Reservations } = await ec2.describeInstances({
					InstanceIds: [id],
				});
				if (Reservations?.[0]?.Instances?.[0]?.State?.Name === "stopped") break;
			}
			await ec2.startInstances({ InstanceIds: [id] }).catch((err) => {
				log(`ec2 restart failed (${err.name}); start ${id} manually`);
			});
		},
	},
	{
		kinds: ["iot.rule"],
		run: async () => {
			const { endpointAddress } = await new IoT({}).describeEndpoint({
				endpointType: "iot:Data-ATS",
			});
			await new IoTDataPlane({
				endpoint: `https://${endpointAddress}`,
			}).publish({
				topic: out.IotTopic,
				qos: 0,
				payload: Buffer.from(JSON.stringify({ hello: "iot" })),
			});
		},
	},
	{
		kinds: ["iot.custom-authorizer"],
		run: async () => {
			await new IoT({}).testInvokeAuthorizer({
				authorizerName: `${STACK}-authorizer`,
				mqttContext: {
					username: "middy",
					password: Buffer.from("capture"),
					clientId: "middy-capture",
				},
			});
		},
	},
	{
		kinds: ["cfn.macro"],
		run: async () => {
			const probe = `${STACK}-macro-probe`;
			const macroName = `${STACK.replace(/-/g, "")}macro`;
			const status = () =>
				cfn.describeStacks({ StackName: probe }).then(
					(r) => r.Stacks[0].StackStatus,
					() => "GONE",
				);
			await cfn.deleteStack({ StackName: probe }).catch(() => {});
			for (let i = 0; i < 24 && (await status()) !== "GONE"; i++) {
				await sleep(5000);
			}
			await cfn.createStack({
				StackName: probe,
				Capabilities: ["CAPABILITY_AUTO_EXPAND"],
				TemplateBody: JSON.stringify({
					Transform: macroName,
					Resources: {
						Noop: { Type: "AWS::CloudFormation::WaitConditionHandle" },
					},
				}),
			});
			// the macro fires while the transform is processed; wait out the
			// probe stack then remove it
			for (let i = 0; i < 24; i++) {
				await sleep(5000);
				const s = await status();
				if (s !== "CREATE_IN_PROGRESS" && s !== "REVIEW_IN_PROGRESS") break;
			}
			await cfn.deleteStack({ StackName: probe }).catch(() => {});
		},
	},
	{
		kinds: ["secrets.rotation"],
		run: async () => {
			await new SecretsManager({})
				.rotateSecret({ SecretId: out.RotationSecretArn })
				.catch((err) => {
					// re-runs while a rotation is already in progress
					log("rotateSecret:", err.name);
				});
		},
	},
	{
		kinds: ["sfn.task"],
		run: async () => {
			await new SFN({}).startExecution({
				stateMachineArn: out.SfnTaskArn,
				input: JSON.stringify({ hello: "sfn", nested: { n: 1 } }),
			});
		},
	},
	{
		kinds: ["sfn.task-token"],
		run: async () => {
			await new SFN({}).startExecution({
				stateMachineArn: out.SfnTokenArn,
				input: JSON.stringify({ hello: "sfn-token" }),
			});
		},
	},
	{
		kinds: ["codepipeline.job"],
		run: async () => {
			const zip = readFileSync(new URL("./assets/source.zip", import.meta.url));
			await new S3({}).putObject({
				Bucket: out.VersionedBucketName,
				Key: "pipeline/source.zip",
				Body: zip,
			});
			await new CodePipeline({}).startPipelineExecution({
				name: out.PipelineName,
			});
		},
	},
	{
		kinds: ["codecommit.push"],
		requires: "CodeCommitRepoName",
		run: async () => {
			const cc = new CodeCommit({});
			const repositoryName = out.CodeCommitRepoName;
			const put = (parentCommitId) =>
				cc.putFile({
					repositoryName,
					branchName: "main",
					filePath: `capture-${Date.now()}.txt`,
					fileContent: Buffer.from("middy capture"),
					parentCommitId,
				});
			try {
				await put(undefined);
			} catch {
				const { branch } = await cc.getBranch({
					repositoryName,
					branchName: "main",
				});
				await put(branch.commitId);
			}
		},
	},
	{
		kinds: ["config.rule"],
		requires: "ConfigRuleName",
		run: async () => {
			const config = new ConfigService({});
			// CloudFormation creates the recorder but does not reliably start it
			await config
				.startConfigurationRecorder({
					ConfigurationRecorderName: `${STACK}-recorder`,
				})
				.catch((err) => {
					log("startConfigurationRecorder:", err.name);
				});
			await new SQS({}).tagQueue({
				QueueUrl: out.SqsStandardQueueUrl,
				Tags: { middy: `capture-${Date.now()}` },
			});
			await config.startConfigRulesEvaluation({
				ConfigRuleNames: [out.ConfigRuleName],
			});
		},
	},
	{
		kinds: ["lambda.dest-success"],
		run: async () => {
			await new Lambda({}).invoke({
				FunctionName: out.HelperSucceedsName,
				InvocationType: "Event",
				Payload: JSON.stringify({ hello: "destination" }),
			});
		},
	},
	{
		kinds: ["lambda.dest-failure"],
		run: async () => {
			await new Lambda({}).invoke({
				FunctionName: out.HelperThrowsName,
				InvocationType: "Event",
				Payload: JSON.stringify({ hello: "failure" }),
			});
		},
	},
	{
		kinds: ["lambda.dlq"],
		run: async () => {
			await new Lambda({}).invoke({
				FunctionName: out.DlqHelperName,
				InvocationType: "Event",
				Payload: JSON.stringify({ hello: "dlq" }),
			});
		},
	},
	{
		kinds: [
			"cognito.pre-signup",
			"cognito.post-confirmation",
			"cognito.pre-auth",
			"cognito.post-auth",
			"cognito.pre-token",
			"cognito.custom-message",
			"cognito.define-auth",
			"cognito.create-auth",
			"cognito.verify-auth",
			"cognito.user-migration",
		],
		run: async () => {
			idToken = await cognitoFlow();
		},
	},
	{
		kinds: ["apigw.rest.proxy"],
		run: async () => {
			const base = out.RestApiUrl;
			await fetch(`${base}/echo/test?x=1&x=2&y=z`, {
				headers: { "x-custom": "one" },
			});
			await fetch(`${base}/echo/post?x=1&x=2&y=z`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ hello: "rest" }),
			});
		},
	},
	{
		kinds: ["apigw.rest.binary"],
		run: async () => {
			await fetch(`${out.RestBinaryUrl}/bin`, {
				method: "POST",
				headers: { "content-type": "application/octet-stream" },
				body: Buffer.from([0x00, 0x01, 0xfe, 0xff]),
			});
		},
	},
	{
		kinds: [
			"apigw.rest.authorized",
			"apigw.authorizer.rest-request",
			"apigw.authorizer.rest-token",
		],
		run: async () => {
			await fetch(`${out.RestApiUrl}/auth`, {
				headers: { Authorization: "allow-request" },
			});
			await fetch(`${out.RestApiUrl}/tokenauth`, {
				headers: { Authorization: "Bearer token-123" },
			});
		},
	},
	{
		kinds: ["apigw.http.v1", "apigw.http.v2"],
		run: async () => {
			await fetch(`${out.HttpApiUrl}/v1?a=1&a=2`, {
				headers: { "x-custom": "one", cookie: "c1=v1; c2=v2" },
			});
			await fetch(`${out.HttpApiUrl}/v2?a=1&a=2`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: "c1=v1; c2=v2",
				},
				body: JSON.stringify({ hello: "v2" }),
			});
		},
	},
	{
		kinds: ["apigw.http.v2-jwt"],
		run: async () => {
			if (!idToken) throw new Error("no cognito IdToken (run cognito unit)");
			await fetch(`${out.HttpApiUrl}/jwt`, {
				headers: { Authorization: `Bearer ${idToken}` },
			});
		},
	},
	{
		kinds: ["apigw.http.v2-authorized", "apigw.authorizer.http-simple"],
		run: async () => {
			await fetch(`${out.HttpApiUrl}/lauth`, {
				headers: { Authorization: "allow-simple" },
			});
		},
	},
	{
		kinds: ["apigw.rest.cognito"],
		run: async () => {
			if (!idToken) throw new Error("no cognito IdToken (run cognito unit)");
			await fetch(`${out.RestApiUrl}/cognito`, {
				headers: { Authorization: idToken },
			});
		},
	},
	{
		kinds: ["apigw.rest.iam"],
		run: async () => {
			const res = await signedFetch(`${out.RestApiUrl}/iam`, "execute-api");
			if (res.status !== 200) throw new Error(`rest iam status ${res.status}`);
		},
	},
	{
		kinds: ["apigw.http.v2-iam"],
		run: async () => {
			const res = await signedFetch(`${out.HttpApiUrl}/iam`, "execute-api");
			if (res.status !== 200) throw new Error(`http iam status ${res.status}`);
		},
	},
	{
		kinds: [
			"apigw.ws.connect",
			"apigw.ws.message",
			"apigw.ws.disconnect",
			"apigw.authorizer.ws",
		],
		run: async () => {
			await new Promise((resolve, reject) => {
				const ws = new WebSocket(`${out.WsUrl}?auth=allow-ws`);
				const timer = setTimeout(() => {
					ws.close();
					reject(new Error("ws timeout"));
				}, 20000);
				ws.addEventListener("open", () => {
					ws.send(JSON.stringify({ action: "echo", hello: "ws" }));
					ws.send(JSON.stringify({ action: "unrouted", hello: "default" }));
					setTimeout(() => ws.close(), 2000);
				});
				ws.addEventListener("close", () => {
					clearTimeout(timer);
					resolve();
				});
				ws.addEventListener("error", (err) => {
					clearTimeout(timer);
					reject(err.error ?? new Error("ws error"));
				});
			});
		},
	},
	{
		kinds: ["functionurl.none"],
		run: async () => {
			await fetch(`${out.FunctionUrlNone}?q=1&q=2`, {
				headers: { "x-custom": "one" },
			});
			await fetch(`${out.FunctionUrlNone}?p=1&p=2`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ hello: "url" }),
			});
		},
	},
	{
		kinds: ["functionurl.iam"],
		run: async () => {
			const res = await signedFetch(out.FunctionUrlIam);
			if (res.status !== 200) throw new Error(`iam url status ${res.status}`);
		},
	},
	{
		kinds: ["appsync.resolver"],
		run: async () => {
			await fetch(out.AppsyncUrl, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-api-key": out.AppsyncApiKey,
				},
				body: JSON.stringify({
					query: "query Capture($i: String) { capture(input: $i) }",
					variables: { i: "hello" },
				}),
			});
		},
	},
	{
		kinds: ["lex.dialog", "lex.fulfillment"],
		run: async () => {
			await new LexRuntimeV2({}).recognizeText({
				botId: out.LexBotId,
				botAliasId: "TSTALIASID",
				localeId: "en_US",
				sessionId: `middy-${Date.now()}`,
				text: "capture",
			});
		},
	},
	{
		kinds: ["bedrock.agent-api", "bedrock.agent-function"],
		requires: "BedrockAgentId",
		run: async () => {
			const rt = new BedrockAgentRuntime({});
			for (let attempt = 0; attempt < 2; attempt++) {
				const res = await rt.invokeAgent({
					agentId: out.BedrockAgentId,
					agentAliasId: out.BedrockAgentAliasId,
					sessionId: `middy-${Date.now()}`,
					inputText:
						"Call the captureApi operation and then call the captureFunction function. Do both now.",
				});
				for await (const chunk of res.completion) void chunk;
			}
		},
	},
	{
		kinds: ["alb.single", "alb.multi"],
		requires: "AlbUrl",
		run: async () => {
			await fetch(`${out.AlbUrl}/?q=1&q=2`, {
				headers: { "x-custom": "one" },
			});
			await fetch(`${out.AlbUrl}/multi?m=1&m=2`, {
				headers: { "x-custom": "one" },
			});
		},
	},
	{
		kinds: ["lattice.v1", "lattice.v2"],
		requires: "LatticeDomain",
		run: async () => {
			await proxyInvoke({
				url: `https://${out.LatticeDomain}/?q=1&q=2`,
				headers: { "x-custom": "one" },
			});
			await proxyInvoke({
				url: `https://${out.LatticeDomain}/v2?q=1&q=2`,
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ hello: "lattice" }),
			});
		},
	},
	{
		kinds: [
			"cloudfront.viewer-request",
			"cloudfront.viewer-request-body",
			"cloudfront.origin-request",
			"cloudfront.origin-response",
			"cloudfront.viewer-response",
		],
		requires: "DistributionDomain",
		run: async () => {
			await fetch(`https://${out.DistributionDomain}/?q=1`);
			await fetch(`https://${out.DistributionDomain}/`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ hello: "edge" }),
			});
		},
	},
	{
		kinds: ["msk.standard", "kafka.self-managed"],
		requires: "MskClusterArn",
		run: async () => {
			const kafka = new Kafka({});
			const brokers = (
				await kafka.getBootstrapBrokers({ ClusterArn: out.MskClusterArn })
			).BootstrapBrokerStringSaslScram.split(",");
			// ensure the self-managed ESM exists (bootstrap brokers are API-only)
			const lambda = new Lambda({});
			const existing = await lambda.listEventSourceMappings({
				FunctionName: out.KafkaSelfFunctionArn,
			});
			if (!existing.EventSourceMappings?.length) {
				const [subnetA, subnetB] = out.VpcSubnetIds.split(",");
				await lambda.createEventSourceMapping({
					FunctionName: out.KafkaSelfFunctionArn,
					Topics: ["middy-capture"],
					StartingPosition: "TRIM_HORIZON",
					SelfManagedEventSource: {
						Endpoints: { KAFKA_BOOTSTRAP_SERVERS: brokers },
					},
					SourceAccessConfigurations: [
						{ Type: "SASL_SCRAM_512_AUTH", URI: out.MskScramSecretArn },
						{ Type: "VPC_SUBNET", URI: `subnet:${subnetA}` },
						{ Type: "VPC_SUBNET", URI: `subnet:${subnetB}` },
						{
							Type: "VPC_SECURITY_GROUP",
							URI: `security_group:${out.VpcSecurityGroupId}`,
						},
					],
				});
				log("created self-managed kafka ESM (takes minutes to enable)");
			}
			const res = await lambda.invoke({
				FunctionName: out.BrokerWriterName,
				Payload: JSON.stringify({
					action: "kafka",
					bootstrapBrokers: brokers,
					topic: "middy-capture",
				}),
			});
			if (res.FunctionError)
				throw new Error(Buffer.from(res.Payload).toString());
		},
	},
	{
		kinds: ["mq.activemq"],
		requires: "ActiveMqBrokerId",
		run: async () => {
			const { BrokerInstances } = await new Mq({}).describeBroker({
				BrokerId: out.ActiveMqBrokerId,
			});
			const console_ = BrokerInstances[0].ConsoleURL;
			await proxyInvoke({
				url: `${console_}/api/message/MIDDY.QUEUE?type=queue`,
				method: "POST",
				headers: { Authorization: mqAuth },
				body: JSON.stringify({ hello: "activemq" }),
			});
		},
	},
	{
		kinds: ["mq.rabbitmq"],
		requires: "RabbitMqBrokerId",
		run: async () => {
			const { BrokerInstances } = await new Mq({}).describeBroker({
				BrokerId: out.RabbitMqBrokerId,
			});
			const console_ = BrokerInstances[0].ConsoleURL;
			await proxyInvoke({
				url: `${console_}/api/queues/%2F/middy-capture`,
				method: "PUT",
				headers: { Authorization: mqAuth, "content-type": "application/json" },
				body: JSON.stringify({ durable: true }),
			});
			// the default exchange is not addressable via the management HTTP
			// API ("amq.default" is a console-only label): bind to amq.direct
			await proxyInvoke({
				url: `${console_}/api/bindings/%2F/e/amq.direct/q/middy-capture`,
				method: "POST",
				headers: { Authorization: mqAuth, "content-type": "application/json" },
				body: JSON.stringify({ routing_key: "middy-capture" }),
			});
			await proxyInvoke({
				url: `${console_}/api/exchanges/%2F/amq.direct/publish`,
				method: "POST",
				headers: { Authorization: mqAuth, "content-type": "application/json" },
				body: JSON.stringify({
					properties: { headers: { source: "middy-events" } },
					routing_key: "middy-capture",
					payload: JSON.stringify({ hello: "rabbit" }),
					payload_encoding: "string",
				}),
			});
		},
	},
	{
		kinds: ["docdb.insert"],
		requires: "BrokerWriterName",
		run: async () => {
			const res = await new Lambda({}).invoke({
				FunctionName: out.BrokerWriterName,
				Payload: JSON.stringify({ action: "docdb" }),
			});
			if (res.FunctionError)
				throw new Error(Buffer.from(res.Payload).toString());
		},
	},
	{
		kinds: ["transfer.custom-idp"],
		requires: "TransferServerId",
		run: async () => {
			await new Transfer({}).testIdentityProvider({
				ServerId: out.TransferServerId,
				ServerProtocol: "SFTP",
				SourceIp: "127.0.0.1",
				UserName: "middy",
				UserPassword: "capture-pass",
			});
		},
	},
	{
		kinds: ["ses.receipt"],
		requires: "SesTestAddress",
		run: async () => {
			await new SESv2({}).sendEmail({
				FromEmailAddress: out.SesTestAddress,
				Destination: { ToAddresses: [out.SesTestAddress] },
				Content: {
					Simple: {
						Subject: { Data: "middy capture" },
						Body: { Text: { Data: "capture body" } },
					},
				},
			});
		},
	},
];

// --- select + fire ---------------------------------------------------------
const byId = new Map(manifest.map((k) => [k.id, k]));
const wanted = new Set(
	requested.includes("all")
		? manifest
				.filter((k) => k.trigger === "auto" || k.trigger === "deploy")
				.map((k) => k.id)
		: requested,
);
for (const id of wanted) {
	if (!byId.has(id)) {
		console.error(`unknown kind: ${id}`);
		process.exit(1);
	}
}

const startTime = Date.now() - 30_000;
const expected = new Map(); // kind -> {timeoutSec}
const skipped = [];

for (const unit of UNITS) {
	const kinds = unit.kinds.filter((k) => wanted.has(k));
	if (!kinds.length) continue;
	if (unit.requires && !out[unit.requires]) {
		skipped.push(...kinds);
		continue;
	}
	log("firing:", kinds.join(", "));
	try {
		const result = await unit.run();
		if (result === "manual-skip") {
			skipped.push(...kinds);
			continue;
		}
		for (const k of kinds)
			expected.set(k, { timeoutSec: byId.get(k)?.timeoutSec ?? 120 });
	} catch (err) {
		log(`FAILED trigger for ${kinds.join(", ")}:`, err.message);
		skipped.push(...kinds.map((k) => `${k} (trigger failed)`));
	}
}

// deploy-time kinds are checked without the time bound
const deployKinds = manifest
	.filter((k) => k.trigger === "deploy" && wanted.has(k.id))
	.map((k) => k.id);

// --- poll captures ---------------------------------------------------------
const foundKinds = async () => {
	const found = new Set();
	// `only` restricts which kinds a scan may mark found: the unbounded
	// (since=0) deploy-kind scan must not credit auto kinds captured in
	// PREVIOUS runs, or repeat runs would mask current trigger failures
	const scan = async (region, logGroupName, since, only) => {
		const logs = new CloudWatchLogs({ region });
		let nextToken;
		do {
			const res = await logs
				.filterLogEvents({
					logGroupName,
					filterPattern: '"MIDDY_CAPTURE"',
					startTime: since,
					nextToken,
				})
				.catch(() => ({ events: [] }));
			for (const ev of res.events ?? []) {
				const m = ev.message.match(/MIDDY_CAPTURE (\S+) /);
				if (m && (!only || only.has(m[1]))) found.add(m[1]);
			}
			nextToken = res.nextToken;
		} while (nextToken);
	};
	await scan(REGION, out.CaptureLogGroupName, startTime);
	if (deployKinds.length)
		await scan(REGION, out.CaptureLogGroupName, 0, new Set(deployKinds));
	if (out.DistributionDomain) {
		for (const region of EDGE_REGIONS) {
			const logs = new CloudWatchLogs({ region });
			const groups = await logs
				.describeLogGroups({
					logGroupNamePrefix: `/aws/lambda/us-east-1.${STACK}-edge-`,
				})
				.catch(() => ({ logGroups: [] }));
			for (const g of groups.logGroups ?? [])
				await scan(region, g.logGroupName, startTime);
		}
	}
	return found;
};

if ("no-wait" in flags) {
	log("fired; skipping wait (--no-wait)");
	process.exit(0);
}

const pollStart = Date.now();
const done = new Set();
const pending = () =>
	[...expected.keys(), ...deployKinds].filter((k) => !done.has(k));
while (true) {
	const found = await foundKinds();
	for (const k of pending()) if (found.has(k)) done.add(k);
	const remaining = pending().filter((k) => {
		const t = (expected.get(k)?.timeoutSec ?? 120) * 1000;
		return Date.now() - pollStart < t;
	});
	log(
		`captured ${done.size}/${expected.size + deployKinds.length}`,
		remaining.length ? `waiting: ${remaining.join(", ")}` : "",
	);
	if (!remaining.length) break;
	await sleep(10_000);
}

// --- report ----------------------------------------------------------------
const timedOut = pending();
console.log("\n=== trigger report ===");
console.log(`captured (${done.size}):`, [...done].sort().join(", ") || "-");
if (skipped.length)
	console.log(`skipped (${skipped.length}):`, skipped.sort().join(", "));
if (timedOut.length)
	console.log(`TIMED OUT (${timedOut.length}):`, timedOut.sort().join(", "));
process.exit(timedOut.length ? 1 : 0);

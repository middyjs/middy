#!/usr/bin/env node
/*
Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
SPDX-License-Identifier: MIT
*/
// Offline validation of the harness: no AWS credentials or network needed.
// 1. template.yaml parses, every Ref/GetAtt/Sub target exists, no duplicate
//    keys, no condition-boundary violations, no dependency cycles, inline
//    code within the 4 KB ZipFile limit, no duplicate FunctionNames/KINDs.
// 2. manifest.json <-> template <-> trigger.mjs kind coverage is consistent.
// 3. Every inline ZipFile handler is EXECUTED in a sandboxed VM with a
//    synthetic event and stubbed AWS SDK clients / fetch, asserting the
//    MIDDY_CAPTURE log line and the service response contract.
// Run after any edit: node selfcheck.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as yaml from "js-yaml";

const read = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
let failures = 0;
const fail = (...a) => {
	failures++;
	console.error("FAIL:", ...a);
};
const ok = (...a) => console.log("ok:", ...a);

// --- 1. template static checks ---------------------------------------------
const src = read("template.yaml");
const stripped = src.replace(
	/!(Ref|Sub|GetAtt|Select|Split|Join|GetAZs|Equals|Not|And|Or|If|Base64|ImportValue|FindInMap|Condition)\b/g,
	"",
);
const doc = yaml.load(stripped); // js-yaml throws on duplicate keys
const res = doc.Resources;
const params = Object.keys(doc.Parameters ?? {});
const conds = Object.keys(doc.Conditions ?? {});
const names = new Set([...Object.keys(res), ...params, ...conds]);

for (const m of src.matchAll(/!Ref\s+([A-Za-z0-9:]+)/g))
	if (!names.has(m[1]) && !/^AWS::/.test(m[1])) fail("dangling Ref", m[1]);
for (const m of src.matchAll(/!GetAtt\s+([A-Za-z0-9]+)\./g))
	if (!names.has(m[1])) fail("dangling GetAtt", m[1]);
for (const m of src.matchAll(/\$\{([A-Za-z0-9]+)(?:\.[A-Za-z0-9.]+)?\}/g))
	if (!names.has(m[1]) && !/^AWS::/.test(m[1]) && m[1] !== "Name")
		fail("dangling Sub", m[1]);

// per-resource raw blocks for reference extraction
const blocks = new Map();
for (const b of src.split(/\n(?= {2}[A-Za-z0-9]+:\n)/)) {
	const m = b.match(/^ {2}([A-Za-z0-9]+):\n/);
	if (m && res[m[1]]) blocks.set(m[1], b);
}
const refsOf = (name) => {
	const b = blocks.get(name) ?? "";
	const out = new Set();
	for (const r of b.matchAll(/!Ref\s+([A-Za-z0-9]+)/g)) out.add(r[1]);
	for (const r of b.matchAll(/!GetAtt\s+([A-Za-z0-9]+)\./g)) out.add(r[1]);
	for (const r of b.matchAll(/\$\{([A-Za-z0-9]+)(?:\.[A-Za-z0-9.]+)?\}/g))
		out.add(r[1]);
	const dep = res[name].DependsOn;
	for (const d of dep ? (Array.isArray(dep) ? dep : [dep]) : []) out.add(d);
	return [...out].filter((t) => t in res && t !== name);
};

// condition boundaries (HasBrokers may depend on HasVpc by design)
for (const [name, r] of Object.entries(res)) {
	const myCond = r.Condition ?? null;
	for (const t of refsOf(name)) {
		const tCond = res[t].Condition ?? null;
		if (
			tCond &&
			tCond !== myCond &&
			!(myCond === "HasBrokers" && tCond === "HasVpc")
		)
			fail(
				"condition boundary",
				`${name} (${myCond ?? "always"}) -> ${t} (${tCond})`,
			);
	}
}

// dependency cycles
{
	const state = new Map(); // 0 visiting, 1 done
	const visit = (n, path) => {
		if (state.get(n) === 1) return;
		if (state.get(n) === 0) {
			fail("dependency cycle", [...path, n].join(" -> "));
			return;
		}
		state.set(n, 0);
		for (const t of refsOf(n)) visit(t, [...path, n]);
		state.set(n, 1);
	};
	for (const n of Object.keys(res)) visit(n, []);
}

// function name / kind uniqueness + ZipFile size
const fnNames = new Map();
const templateKinds = new Set([
	// kinds computed in code rather than KIND env
	"lex.dialog",
	"lex.fulfillment",
	"cloudfront.viewer-request",
	"cloudfront.viewer-request-body",
	"cloudfront.origin-request",
	"cloudfront.origin-response",
	"cloudfront.viewer-response",
]);
for (const [name, r] of Object.entries(res)) {
	if (r.Type !== "AWS::Lambda::Function") continue;
	const fnName = JSON.stringify(r.Properties.FunctionName);
	if (fnNames.has(fnName))
		fail("duplicate FunctionName", name, fnNames.get(fnName));
	fnNames.set(fnName, name);
	const kind = r.Properties.Environment?.Variables?.KIND;
	if (kind) {
		if (templateKinds.has(kind)) fail("duplicate KIND", kind);
		templateKinds.add(kind);
	}
	const zip = r.Properties.Code?.ZipFile;
	if (zip && zip.length > 4096)
		fail("ZipFile over 4096 bytes", name, zip.length);
	else if (zip && zip.length > 3500)
		console.warn("warn: ZipFile near limit", name, zip.length);
}
ok(`template: ${Object.keys(res).length} resources statically clean`);

// --- 2. manifest / trigger cross-checks -------------------------------------
const manifest = JSON.parse(read("manifest.json")).kinds;
const ids = manifest.map((k) => k.id);
if (new Set(ids).size !== ids.length) fail("duplicate manifest ids");
const trig = read("trigger.mjs");
const unitKinds = [...trig.matchAll(/kinds: \[([^\]]+)\]/gs)].flatMap((m) =>
	[...m[1].matchAll(/"([a-z0-9.@-]+)"/g)].map((x) => x[1]),
);
for (const k of manifest) {
	if (k.trigger === "documented") continue;
	if (!templateKinds.has(k.id))
		fail("manifest kind missing from template", k.id);
	if (k.trigger !== "deploy" && !unitKinds.includes(k.id))
		fail("manifest kind without trigger unit", k.id);
	if (k.requires && !(k.requires in (doc.Outputs ?? {})))
		fail("manifest requires missing Output", k.id, k.requires);
}
for (const k of templateKinds)
	if (!manifest.some((m) => m.id === k))
		fail("template kind missing from manifest", k);
for (const k of unitKinds)
	if (!manifest.some((m) => m.id === k))
		fail("trigger kind missing from manifest", k);
ok(
	`kinds: ${manifest.filter((k) => k.trigger !== "documented").length} deployable / ${manifest.length} total, cross-checked`,
);

// --- 3. execute every inline handler ----------------------------------------
const makeSdkStub = (calls) =>
	new Proxy(
		{},
		{
			get: (_, exportName) =>
				class {
					constructor() {
						// biome-ignore lint/correctness/noConstructorReturn: stub client
						return new Proxy(this, {
							get: (_t, method) => {
								if (method === "then") return undefined;
								return async (params) => {
									calls.push({
										client: String(exportName),
										method: String(method),
										params,
									});
									return {};
								};
							},
						});
					}
				},
		},
	);

const runHandler = async (code, { env = {}, event, fetchImpl }) => {
	const calls = [];
	const logs = [];
	const fetches = [];
	const module = { exports: {} };
	const ctx = vm.createContext({
		module,
		exports: module.exports,
		require: (id) => {
			if (id.startsWith("@aws-sdk/")) return makeSdkStub(calls);
			if (id === "node:tls" || id === "tls") return { DEFAULT_MIN_VERSION: "" };
			throw new Error(`unexpected require: ${id}`);
		},
		process: { env: { ...env } },
		console: {
			log: (...a) => logs.push(a.join(" ")),
			error: () => {},
			warn: () => {},
		},
		fetch:
			fetchImpl ??
			(async (url, opts = {}) => {
				fetches.push({ url, ...opts });
				return { status: 200, text: async () => "ok" };
			}),
		Buffer,
	});
	vm.runInContext(code, ctx, { filename: "zipfile.js" });
	const result = await module.exports.handler(event, {});
	return { result, logs, calls, fetches };
};

const is = (cond, name, msg) => {
	if (!cond) fail(`handler ${name}:`, msg);
};
const captureLogged = (logs, kind, name) => {
	const line = logs.find((l) => l.startsWith(`MIDDY_CAPTURE ${kind} `));
	is(
		line,
		name,
		`no MIDDY_CAPTURE ${kind} log line (got: ${logs[0] ?? "none"})`,
	);
	if (line) {
		try {
			JSON.parse(line.slice(`MIDDY_CAPTURE ${kind} `.length));
		} catch {
			fail(`handler ${name}:`, "capture payload is not valid JSON");
		}
	}
};

const cfEvent = (obj) => ({ Records: [{ cf: obj }] });
const cognitoEvent = (extra = {}) => ({ request: {}, response: {}, ...extra });
// per-logical-id execution specs; unlisted functions get the default:
// event {test:true}, assert capture log + object result
const SPECS = {
	HelperSucceeds: {
		noCapture: true,
		event: { a: 1 },
		check: ({ result }, n) => is(result.ok === true, n, "expected {ok:true}"),
	},
	HelperThrows: { noCapture: true, expectThrow: true, event: {} },
	HelperThrowsDlq: { noCapture: true, expectThrow: true, event: {} },
	FnProxy: {
		noCapture: true,
		event: { url: "https://in-vpc.example/" },
		check: ({ result }, n) =>
			is(result.status === 200 && result.body === "ok", n, "proxy relay shape"),
	},
	FnS3Object: {
		event: { getObjectContext: { outputRoute: "r", outputToken: "t" } },
		check: ({ result, calls }, n) => {
			const c = calls.find((c) => c.method === "writeGetObjectResponse");
			is(c?.params?.RequestToken === "t", n, "WriteGetObjectResponse token");
			is(result.statusCode === 200, n, "statusCode 200");
		},
	},
	FnS3Batch: {
		event: {
			invocationSchemaVersion: "1.0",
			invocationId: "inv",
			tasks: [{ taskId: "t1", s3Key: "k" }],
		},
		check: ({ result }, n) => {
			is(result.invocationId === "inv", n, "invocationId echoed");
			is(result.results?.[0]?.resultCode === "Succeeded", n, "task Succeeded");
		},
	},
	FnFirehose: {
		event: { records: [{ recordId: "r1", data: "ZGF0YQ==" }] },
		check: ({ result }, n) =>
			is(
				result.records?.[0]?.result === "Ok" &&
					result.records[0].recordId === "r1",
				n,
				"firehose record contract",
			),
	},
	FnSfnToken: {
		event: { token: "tok", input: {} },
		check: ({ calls }, n) =>
			is(
				calls.some(
					(c) => c.method === "sendTaskSuccess" && c.params.taskToken === "tok",
				),
				n,
				"sendTaskSuccess(taskToken)",
			),
	},
	FnCodepipeline: {
		event: { "CodePipeline.job": { id: "job-1" } },
		check: ({ calls }, n) =>
			is(
				calls.some(
					(c) =>
						c.method === "putJobSuccessResult" && c.params.jobId === "job-1",
				),
				n,
				"putJobSuccessResult(jobId)",
			),
	},
	FnCfn: {
		event: {
			RequestType: "Create",
			ResponseURL: "https://cfn.example/presigned",
			StackId: "stack",
			RequestId: "req",
			LogicalResourceId: "CustomCapture",
			ResourceProperties: {},
		},
		check: ({ fetches }, n) => {
			const put = fetches[0];
			is(put?.method === "PUT", n, "PUT to ResponseURL");
			const body = put ? JSON.parse(put.body) : {};
			is(
				body.Status === "SUCCESS" && body.RequestId === "req",
				n,
				"SUCCESS body",
			);
		},
	},
	FnCfnMacro: {
		event: { requestId: "rq", fragment: { Resources: { X: 1 } } },
		check: ({ result }, n) => {
			is(
				result.status === "success" && result.requestId === "rq",
				n,
				"macro status",
			);
			is(result.fragment?.Resources?.X === 1, n, "fragment echoed");
		},
	},
	FnLex: {
		runs: [
			{
				kind: "lex.dialog",
				event: {
					invocationSource: "DialogCodeHook",
					sessionState: { intent: { name: "CaptureIntent" } },
				},
				check: ({ result }, n) =>
					is(
						result.sessionState?.dialogAction?.type === "Delegate",
						n,
						"dialog Delegate",
					),
			},
			{
				kind: "lex.fulfillment",
				event: {
					invocationSource: "FulfillmentCodeHook",
					sessionState: { intent: { name: "CaptureIntent" } },
				},
				check: ({ result }, n) => {
					is(
						result.sessionState?.dialogAction?.type === "Close",
						n,
						"fulfillment Close",
					);
					is(
						result.sessionState?.intent?.state === "Fulfilled",
						n,
						"intent Fulfilled",
					);
				},
			},
		],
	},
	FnEdgeViewerRequest: {
		runs: [
			{
				kind: "cloudfront.viewer-request",
				event: cfEvent({ request: { uri: "/", headers: {} } }),
				check: ({ result }, n) => is(result.uri === "/", n, "returns request"),
			},
			{
				kind: "cloudfront.viewer-request-body",
				event: cfEvent({ request: { uri: "/", body: { data: "aGk=" } } }),
				check: ({ result }, n) =>
					is(result.body?.data === "aGk=", n, "returns request w/ body"),
			},
		],
	},
	FnEdgeOriginRequest: {
		kind: "cloudfront.origin-request",
		event: cfEvent({ request: { uri: "/o" } }),
		check: ({ result }, n) => is(result.uri === "/o", n, "returns request"),
	},
	FnEdgeOriginResponse: {
		kind: "cloudfront.origin-response",
		event: cfEvent({ request: { uri: "/" }, response: { status: "200" } }),
		check: ({ result }, n) =>
			is(result.status === "200", n, "returns response"),
	},
	FnEdgeViewerResponse: {
		kind: "cloudfront.viewer-response",
		event: cfEvent({ request: { uri: "/" }, response: { status: "200" } }),
		check: ({ result }, n) =>
			is(result.status === "200", n, "returns response"),
	},
	FnAuthRestToken: {
		event: { methodArn: "arn:m" },
		check: authPolicyCheck("arn:m"),
	},
	FnAuthRestRequest: {
		event: { methodArn: "arn:m" },
		check: authPolicyCheck("arn:m"),
	},
	FnAuthWs: { event: { methodArn: "arn:m" }, check: authPolicyCheck("arn:m") },
	FnAuthHttpSimple: {
		event: { routeArn: "arn:r" },
		check: ({ result }, n) =>
			is(result.isAuthorized === true, n, "isAuthorized"),
	},
	FnCognitoPreSignup: {
		event: cognitoEvent(),
		check: ({ result }, n) =>
			is(
				result.response.autoConfirmUser === true &&
					result.response.autoVerifyEmail === true,
				n,
				"auto-confirm + auto-verify",
			),
	},
	FnCognitoDefineAuth: {
		runs: [
			{
				event: cognitoEvent({ request: { session: [] } }),
				check: ({ result }, n) =>
					is(
						result.response.challengeName === "CUSTOM_CHALLENGE" &&
							result.response.issueTokens === false,
						n,
						"first round issues challenge",
					),
			},
			{
				event: cognitoEvent({
					request: { session: [{ challengeResult: true }] },
				}),
				check: ({ result }, n) =>
					is(
						result.response.issueTokens === true,
						n,
						"passed round issues tokens",
					),
			},
		],
	},
	FnCognitoCreateAuth: {
		event: cognitoEvent({ request: { session: [] } }),
		check: ({ result }, n) =>
			is(
				result.response.privateChallengeParameters?.answer === "42",
				n,
				"challenge parameters",
			),
	},
	FnCognitoVerifyAuth: {
		runs: [
			{
				event: cognitoEvent({ request: { challengeAnswer: "42" } }),
				check: ({ result }, n) =>
					is(result.response.answerCorrect === true, n, "correct answer"),
			},
			{
				event: cognitoEvent({ request: { challengeAnswer: "nope" } }),
				check: ({ result }, n) =>
					is(result.response.answerCorrect === false, n, "wrong answer"),
			},
		],
	},
	FnCognitoUserMigration: {
		event: cognitoEvent({ userName: "u@example.com" }),
		check: ({ result }, n) => {
			is(result.response.finalUserStatus === "CONFIRMED", n, "CONFIRMED");
			is(result.response.messageAction === "SUPPRESS", n, "SUPPRESS");
			is(
				result.response.userAttributes?.email === "u@example.com",
				n,
				"email mapped",
			);
		},
	},
	FnIotAuthorizer: {
		event: { protocolData: { mqtt: { clientId: "c" } } },
		check: ({ result }, n) => {
			is(result.isAuthenticated === true, n, "isAuthenticated");
			is(
				Array.isArray(result.policyDocuments) &&
					result.policyDocuments[0]?.Statement,
				n,
				"policyDocuments",
			);
		},
	},
	FnBedrockApi: {
		event: { actionGroup: "g", apiPath: "/capture", httpMethod: "POST" },
		check: ({ result }, n) => {
			is(result.messageVersion === "1.0", n, "messageVersion");
			is(
				result.response?.httpStatusCode === 200 &&
					result.response?.apiPath === "/capture",
				n,
				"api response contract",
			);
		},
	},
	FnBedrockFn: {
		event: { actionGroup: "g", function: "captureFunction" },
		check: ({ result }, n) =>
			is(
				result.response?.functionResponse?.responseBody?.TEXT,
				n,
				"function response contract",
			),
	},
	FnTransferIdp: {
		event: { username: "middy", protocol: "SFTP" },
		check: ({ result }, n) => {
			is(
				typeof result.Role === "string" && result.Role.length > 0,
				n,
				"Role set",
			);
			is(
				typeof result.HomeDirectory === "string" &&
					result.HomeDirectory.endsWith("/transfer"),
				n,
				"HomeDirectory set",
			);
		},
	},
	FnDdbWindowed: {
		event: { Records: [], state: { n: 1 } },
		check: ({ result }, n) =>
			is(result.state?.n === 1, n, "window state echoed"),
	},
	FnKinesisWindowed: {
		event: { Records: [], state: { n: 1 } },
		check: ({ result }, n) =>
			is(result.state?.n === 1, n, "window state echoed"),
	},
	FnAppsync: {
		event: { arguments: { input: "hi" } },
		check: ({ result }, n) => {
			is(typeof result === "string", n, "AWSJSON string");
			is(JSON.parse(result).ok === true, n, "AWSJSON parses");
		},
	},
};
function authPolicyCheck(arn) {
	return ({ result }, n) => {
		is(result.principalId === "middy", n, "principalId");
		is(
			result.policyDocument?.Statement?.[0]?.Resource === arn &&
				result.policyDocument.Statement[0].Effect === "Allow",
			n,
			"Allow policy on methodArn",
		);
	};
}
// cognito passthrough triggers share one spec
for (const id of [
	"FnCognitoPostConfirmation",
	"FnCognitoPreAuth",
	"FnCognitoPostAuth",
	"FnCognitoPreToken",
	"FnCognitoCustomMessage",
]) {
	SPECS[id] = {
		event: cognitoEvent(),
		check: ({ result }, n) =>
			is(result?.request && result?.response, n, "event returned"),
	};
}
// http-mode functions must return an API-shaped response
const HTTP_FNS = [
	"FnApigwRestProxy",
	"FnApigwRestAuthorized",
	"FnApigwRestBinary",
	"FnApigwRestCognito",
	"FnApigwRestIam",
	"FnApigwHttpV1",
	"FnApigwHttpV2",
	"FnApigwHttpV2Jwt",
	"FnApigwHttpV2Authorized",
	"FnApigwHttpV2Iam",
	"FnUrlNone",
	"FnUrlIam",
	"FnWsConnect",
	"FnWsMessage",
	"FnWsDisconnect",
	"FnAlbSingle",
	"FnLatticeV1",
	"FnLatticeV2",
];
for (const id of HTTP_FNS)
	SPECS[id] = {
		event: { rawPath: "/", headers: {} },
		check: ({ result }, n) =>
			is(result.statusCode === 200, n, "statusCode 200"),
	};
SPECS.FnAlbMulti = {
	event: { path: "/multi" },
	check: ({ result }, n) =>
		is(
			result.statusCode === 200 && result.multiValueHeaders,
			n,
			"multiValueHeaders response",
		),
};

let executed = 0;
for (const [name, r] of Object.entries(res)) {
	if (r.Type !== "AWS::Lambda::Function") continue;
	const zip = r.Properties.Code?.ZipFile;
	if (!zip) continue; // broker-writer is packaged separately
	const envVars = {};
	for (const [k, v] of Object.entries(
		r.Properties.Environment?.Variables ?? {},
	))
		envVars[k] = typeof v === "string" ? v : JSON.stringify(v);
	const spec = SPECS[name] ?? { event: { test: true } };
	const runs = spec.runs ?? [spec];
	for (const run of runs) {
		try {
			const outcome = await runHandler(zip, {
				env: envVars,
				event: run.event ?? { test: true },
			});
			if (spec.expectThrow) {
				fail(`handler ${name}:`, "expected throw, resolved instead");
				continue;
			}
			const kind = run.kind ?? envVars.KIND;
			if (!spec.noCapture && kind) captureLogged(outcome.logs, kind, name);
			run.check?.(outcome, name);
			if (!run.check && !spec.noCapture)
				is(typeof outcome.result === "object", name, "returns an object");
			executed++;
		} catch (err) {
			if (spec.expectThrow) {
				executed++;
			} else {
				fail(`handler ${name}:`, `threw: ${err.message}`);
			}
		}
	}
}
ok(
	`handlers: ${executed} executions across ${fnNames.size} functions (broker-writer is packaged, not inline)`,
);

// --- verdict ----------------------------------------------------------------
if (failures) {
	console.error(`\nselfcheck: ${failures} failure(s)`);
	process.exit(1);
}
console.log("\nselfcheck: PASS");

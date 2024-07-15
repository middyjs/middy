"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[7450],{1257:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>l,default:()=>m,frontMatter:()=>i,metadata:()=>c,toc:()=>h});var a=n(5893),s=n(1151),r=n(4866),o=n(5162);const i={title:"Powertools for AWS Lambda"},l=void 0,c={id:"integrations/lambda-powertools",title:"Powertools for AWS Lambda",description:"Powertools for AWS is a developer toolkit to implement Serverless best practices and increase developer velocity.",source:"@site/docs/integrations/lambda-powertools.md",sourceDirName:"integrations",slug:"/integrations/lambda-powertools",permalink:"/docs/integrations/lambda-powertools",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/integrations/lambda-powertools.md",tags:[],version:"current",lastUpdatedAt:1721056395,formattedLastUpdatedAt:"Jul 15, 2024",frontMatter:{title:"Powertools for AWS Lambda"},sidebar:"tutorialSidebar",previous:{title:"Apollo Server",permalink:"/docs/integrations/apollo-server"},next:{title:"Pino",permalink:"/docs/integrations/pino"}},d={},h=[{value:"Intro",id:"intro",level:2},{value:"Logger",id:"logger",level:2},{value:"Install",id:"install",level:3},{value:"Options",id:"options",level:3},{value:"Sample usage",id:"sample-usage",level:3},{value:"Tracer",id:"tracer",level:2},{value:"Install",id:"install-1",level:3},{value:"Options",id:"options-1",level:3},{value:"Sample usage",id:"sample-usage-1",level:3},{value:"Metrics",id:"metrics",level:2},{value:"Install",id:"install-2",level:3},{value:"Options",id:"options-2",level:3},{value:"Sample usage",id:"sample-usage-2",level:3},{value:"Idempotency",id:"idempotency",level:2},{value:"Install",id:"install-3",level:3},{value:"Options",id:"options-3",level:3},{value:"Sample usage",id:"sample-usage-3",level:3},{value:"Best practices",id:"best-practices",level:2},{value:"Using multiple utilities",id:"using-multiple-utilities",level:3},{value:"Cleaning up on early returns",id:"cleaning-up-on-early-returns",level:3}];function u(e){const t={a:"a",admonition:"admonition",code:"code",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,s.a)(),...e.components};return(0,a.jsxs)(a.Fragment,{children:[(0,a.jsxs)(t.p,{children:["Powertools for AWS is a developer toolkit to implement Serverless ",(0,a.jsx)(t.a,{href:"https://s12d.com/middy-intro",children:"best practices and increase developer velocity"}),"."]}),"\n",(0,a.jsx)(t.p,{children:"You can use Powertools for AWS in both TypeScript and JavaScript code bases."}),"\n",(0,a.jsx)(t.admonition,{type:"note",children:(0,a.jsxs)(t.p,{children:["Powertools officially supports ",(0,a.jsx)(t.code,{children:"@middy/core"})," both v4.x and v5.x."]})}),"\n",(0,a.jsx)(t.h2,{id:"intro",children:"Intro"}),"\n",(0,a.jsx)(t.p,{children:"Powertools is a collection of utilities that can be used independently or together to help you build production-ready serverless applications. Currently, Powertools provides the following utilities that are compatible with Middy:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.a,{href:"https://s12d.com/middy-logger",children:(0,a.jsx)(t.strong,{children:"Logger"})})," - Structured logging made easier with a middleware to capture key fields from the Lambda context, cold starts, and more. Compatible with Amazon CloudWatch, Datadog, and more."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.a,{href:"https://s12d.com/middy-tracer",children:(0,a.jsx)(t.strong,{children:"Tracer"})})," - An opinionated wrapper around AWS X-Ray SDK for Node.js with a middleware to automatically capture traces for function invocations, HTTP requests, and AWS SDK calls, and more."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.a,{href:"https://s12d.com/middy-metrics",children:(0,a.jsx)(t.strong,{children:"Metrics"})})," - Create Amazon CloudWatch custom metrics asynchronously with a middleware that takes care of capturing cold starts, and flushes metrics to CloudWatch in ",(0,a.jsx)(t.a,{href:"https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html",children:"EMF-formatted"})," batches."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.a,{href:"https://s12d.com/middy-idempotency",children:(0,a.jsx)(t.strong,{children:"Idempotency"})})," - Middleware to make your Lambda functions idempotent and prevent duplicate execution based on payload content."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.a,{href:"https://s12d.com/middy-parser",children:(0,a.jsx)(t.strong,{children:"Parser"})})," - Data validation and parsing using Zod, a TypeScript-first schema declaration and validation library."]}),"\n"]}),"\n",(0,a.jsx)(t.p,{children:"Powertools also provides other utilities that can be used independently of Middy:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.a,{href:"https://s12d.com/middy-batch-processing",children:(0,a.jsx)(t.strong,{children:"Parameters"})})," - Handle partial failures when processing batches of records from Amazon SQS, Amazon Kinesis Data Streams, and Amazon DynamoDB Streams."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.a,{href:"https://s12d.com/middy-parameters",children:(0,a.jsx)(t.strong,{children:"Batch Processing"})})," - Handle partial failures when processing batches of records from Amazon SQS, Amazon Kinesis Data Streams, and Amazon DynamoDB Streams."]}),"\n"]}),"\n",(0,a.jsx)(t.h2,{id:"logger",children:"Logger"}),"\n",(0,a.jsx)(t.p,{children:"Key features:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsx)(t.li,{children:"Capturing key fields from the Lambda context, cold starts, and structure logging output as JSON."}),"\n",(0,a.jsx)(t.li,{children:"Logging Lambda invocation events when instructed (disabled by default)."}),"\n",(0,a.jsx)(t.li,{children:"Printing all the logs only for a percentage of invocations via log sampling (disabled by default)."}),"\n",(0,a.jsx)(t.li,{children:"Appending additional keys to structured logs at any point in time."}),"\n",(0,a.jsx)(t.li,{children:"Providing a custom log formatter (Bring Your Own Formatter) to output logs in a structure compatible with your organization\u2019s Logging RFC."}),"\n"]}),"\n",(0,a.jsx)(t.h3,{id:"install",children:"Install"}),"\n",(0,a.jsxs)(r.Z,{groupId:"npm2yarn",children:[(0,a.jsx)(o.Z,{value:"npm",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"npm install --save @aws-lambda-powertools/logger\n"})})}),(0,a.jsx)(o.Z,{value:"yarn",label:"Yarn",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"yarn add @aws-lambda-powertools/logger\n"})})}),(0,a.jsx)(o.Z,{value:"pnpm",label:"pnpm",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"pnpm add @aws-lambda-powertools/logger\n"})})})]}),"\n",(0,a.jsx)(t.h3,{id:"options",children:"Options"}),"\n",(0,a.jsx)(t.p,{children:"Class constructor accepts the following options, which are all optional:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"logLevel"})," (string|LogLevel): Log level to use. Defaults to ",(0,a.jsx)(t.code,{children:"INFO"}),", but you can use any of the following values: ",(0,a.jsx)(t.code,{children:"SILENT"}),", ",(0,a.jsx)(t.code,{children:"DEBUG"}),", ",(0,a.jsx)(t.code,{children:"INFO"}),", ",(0,a.jsx)(t.code,{children:"WARN"}),", ",(0,a.jsx)(t.code,{children:"ERROR"}),", ",(0,a.jsx)(t.code,{children:"CRITICAL"}),"."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"serviceName"})," (string): Service name to use that will be used in all log statements. Defaults to ",(0,a.jsx)(t.code,{children:"service_undefined"}),"."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"sampleRateValue"})," (number): number between ",(0,a.jsx)(t.code,{children:"0.0"})," and ",(0,a.jsx)(t.code,{children:"1"})," to determine the sample rate for debug logging. Defaults to ",(0,a.jsx)(t.code,{children:"0"})," (no debub logging)."]}),"\n"]}),"\n",(0,a.jsx)(t.p,{children:"Middleware accepts the following options:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"logger"})," (Logger) (required): An instance of the Logger class."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"option"})," (object) (optional): An object with the following keys:","\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"logEvent"})," (boolean) (optional): Whether to log the Lambda invocation event. Defaults to ",(0,a.jsx)(t.code,{children:"false"}),"."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"clearState"})," (boolean) (optional): Whether to clear the logger state after each invocation. Defaults to ",(0,a.jsx)(t.code,{children:"false"}),"."]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,a.jsx)(t.h3,{id:"sample-usage",children:"Sample usage"}),"\n",(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core';\nimport { Logger } from '@aws-lambda-powertools/logger';\nimport { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';\n\nconst logger = new Logger({ serviceName: 'serverlessAirline' });\n\nconst lambdaHandler = async (_event, _context) => {\n  logger.info('This is an INFO log with some context', {\n    foo: {\n      bar: 'baz'\n    }\n  });\n};\n\nexport const handler = middy(lambdaHandler)\n  .use(injectLambdaContext(logger));\n"})}),"\n",(0,a.jsx)(t.p,{children:"The above code will output the following log:"}),"\n",(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-json",children:'{\n  "cold_start": true,\n  "function_arn": "arn:aws:lambda:eu-west-1:123456789012:function:shopping-cart-api-lambda-prod-eu-west-1",\n  "function_memory_size": 128,\n  "function_request_id": "c6af9ac6-7b61-11e6-9a41-93e812345678",\n  "function_name": "shopping-cart-api-lambda-prod-eu-west-1",\n  "level": "INFO",\n  "message": "This is an INFO log with some context",\n  "foo": {\n    "bar": "baz"\n  },\n  "service": "serverlessAirline",\n  "timestamp": "2021-12-12T21:21:08.921Z",\n  "xray_trace_id": "abcdef123456abcdef123456abcdef123456"\n}\n'})}),"\n",(0,a.jsxs)(t.p,{children:["As you can see, the log entry includes several fields that are automatically captured by the Logger utility, and that can help you better understand the context of the log entry. For example, the ",(0,a.jsx)(t.code,{children:"cold_start"})," field indicates whether the Lambda function was cold started or not, and the ",(0,a.jsx)(t.code,{children:"xray_trace_id"})," field contains the AWS X-Ray trace ID for the Lambda invocation. This is useful when you're troubleshooting a problem and want to correlate the logs with the traces."]}),"\n",(0,a.jsxs)(t.p,{children:["The Logger utility also allows you to append arbitary keys to the log entry at both ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#appending-persistent-additional-log-keys-and-values",children:"the global level"}),", at the ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#clearing-all-state",children:"invocation level"}),", and at the ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#appending-additional-data-to-a-single-log-item",children:"single log level"}),". For example, there might be some keys that you want to include in all log entries, such as the ",(0,a.jsx)(t.code,{children:"environment"})," key to differentiate between the ",(0,a.jsx)(t.code,{children:"prod"})," and ",(0,a.jsx)(t.code,{children:"dev"})," environments, or in other cases you might want to include some keys only for a specific log entry, such as the ",(0,a.jsx)(t.code,{children:"customer_id"})," key to identify the customer that triggered the Lambda invocation."]}),"\n",(0,a.jsxs)(t.p,{children:["Additionally, you can also configure Logger to ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#log-incoming-event",children:"log the Lambda invocation event"}),", which can be useful when you're troubleshooting a problem and want to see the event that triggered the Lambda invocation. Finally, Logger allows you to ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#custom-log-formatter-bring-your-own-formatter",children:"define a custom log formatter"})," to output logs in a different JSON structure from the default one. This is useful when you want to output logs in a structure that is compatible with your organization's requirements."]}),"\n",(0,a.jsx)(t.h2,{id:"tracer",children:"Tracer"}),"\n",(0,a.jsx)(t.p,{children:"Key features:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsx)(t.li,{children:"Auto-capturing cold start and service name as annotations, and responses or full exceptions as metadata."}),"\n",(0,a.jsx)(t.li,{children:"Automatically tracing HTTP(S) clients and generating segments for each request."}),"\n",(0,a.jsx)(t.li,{children:"Supporting tracing functions via decorators, middleware, and manual instrumentation."}),"\n",(0,a.jsx)(t.li,{children:"Supporting tracing AWS SDK v2 and v3 via AWS X-Ray SDK for Node.js."}),"\n",(0,a.jsx)(t.li,{children:"Auto-disable tracing when not running in the Lambda environment."}),"\n"]}),"\n",(0,a.jsx)(t.h3,{id:"install-1",children:"Install"}),"\n",(0,a.jsxs)(r.Z,{groupId:"npm2yarn",children:[(0,a.jsx)(o.Z,{value:"npm",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"npm install --save @aws-lambda-powertools/tracer\n"})})}),(0,a.jsx)(o.Z,{value:"yarn",label:"Yarn",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"yarn add @aws-lambda-powertools/tracer\n"})})}),(0,a.jsx)(o.Z,{value:"pnpm",label:"pnpm",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"pnpm add @aws-lambda-powertools/tracer\n"})})})]}),"\n",(0,a.jsx)(t.h3,{id:"options-1",children:"Options"}),"\n",(0,a.jsx)(t.p,{children:"Class constructor accepts the following options, which are all optional:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"serviceName"})," (string): Service name to use that will be used in all log statements. Defaults to ",(0,a.jsx)(t.code,{children:"service_undefined"}),"."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"enabled"})," (boolean): Whether to enable tracing. Defaults to ",(0,a.jsx)(t.code,{children:"true"}),"."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"captureHTTPsRequests"})," (boolean): Whether to capture outgoing HTTP(S) requests as segment metadata. Defaults to ",(0,a.jsx)(t.code,{children:"true"}),"."]}),"\n"]}),"\n",(0,a.jsx)(t.p,{children:"Middleware accepts the following options:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"tracer"})," (Tracer) (required): An instance of the Tracer class."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"option"})," (object) (optional): An object with the following keys:","\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"captureResponse"})," (boolean) (optional): Whether to capture the Lambda invocation result as segment metadata. Defaults to ",(0,a.jsx)(t.code,{children:"true"}),"."]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,a.jsx)(t.h3,{id:"sample-usage-1",children:"Sample usage"}),"\n",(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core';\nimport { Tracer } from '@aws-lambda-powertools/tracer';\nimport { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';\nimport { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';\n\nconst tracer = new Tracer({\n  serviceName: 'serverlessAirline'\n});\n\nconst client = tracer.captureAWSv3Client(\n  new SecretsManagerClient({})\n);\n\nconst lambdaHandler = async (_event, _context) => {\n  tracer.putAnnotation('successfulBooking', true);\n};\n\nexport const handler = middy(lambdaHandler)\n  .use(captureLambdaHandler(tracer));\n"})}),"\n",(0,a.jsxs)(t.p,{children:["The above code instructs the Tracer utility to create a custom segment named ",(0,a.jsx)(t.code,{children:"## index.handler"})," and to add an annotation to it with the key ",(0,a.jsx)(t.code,{children:"successfulBooking"})," and the value ",(0,a.jsx)(t.code,{children:"true"}),". The segment name is automatically generated based on the handler name, and the ",(0,a.jsx)(t.code,{children:"##"})," prefix is used to indicate that this is a custom segment. The Tracer utility also automatically captures the cold start and service name as annotations, and the Lambda invocation result or any error thrown ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/tracer/#annotations-metadata",children:"as metadata"}),". The segment data will be automatically sent to AWS X-Ray when the Lambda function completes its execution."]}),"\n",(0,a.jsxs)(t.p,{children:["Tracer also automatically ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/tracer/#tracing-http-requests",children:"captures and traces any outgoing HTTP(S) requests"})," made by the Lambda function. For example, if your function makes a request to a custom API, the Tracer utility will automatically create a segment for that request which will appear in your trace data and service map. Additionally, it will also ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/tracer/#patching-aws-sdk-clients",children:"capture any AWS SDK calls"})," made by the function, and do the same for them."]}),"\n",(0,a.jsx)(t.h2,{id:"metrics",children:"Metrics"}),"\n",(0,a.jsx)(t.p,{children:"Key features:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:["Aggregating up to 100 metrics using a single ",(0,a.jsx)(t.a,{href:"https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html",children:"CloudWatch EMF"})," object."]}),"\n",(0,a.jsx)(t.li,{children:"Validating your metrics against common metric definitions mistakes (for example, metric unit, values, max dimensions, max metrics)."}),"\n",(0,a.jsx)(t.li,{children:"Metrics are created asynchronously by the CloudWatch service. You do not need any custom stacks, and there is no impact to Lambda function latency."}),"\n",(0,a.jsx)(t.li,{children:"Creating a one-off metric with different dimensions."}),"\n"]}),"\n",(0,a.jsxs)(t.p,{children:["If you're new to Amazon CloudWatch, there are a few terms like ",(0,a.jsx)(t.code,{children:"Namespace"}),", ",(0,a.jsx)(t.code,{children:"Dimensions"}),", ",(0,a.jsx)(t.code,{children:"Unit"}),", etc, that you must be aware of before you start using the Metrics utility. To learn more about these terms, see the ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#terminologies",children:"documentation on PowerTools Metrics"}),"."]}),"\n",(0,a.jsx)(t.h3,{id:"install-2",children:"Install"}),"\n",(0,a.jsxs)(r.Z,{groupId:"npm2yarn",children:[(0,a.jsx)(o.Z,{value:"npm",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"npm install --save @aws-lambda-powertools/metrics\n"})})}),(0,a.jsx)(o.Z,{value:"yarn",label:"Yarn",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"yarn add @aws-lambda-powertools/metrics\n"})})}),(0,a.jsx)(o.Z,{value:"pnpm",label:"pnpm",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"pnpm add @aws-lambda-powertools/metrics\n"})})})]}),"\n",(0,a.jsx)(t.h3,{id:"options-2",children:"Options"}),"\n",(0,a.jsx)(t.p,{children:"Class constructor accepts the following options, which are all optional:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"serviceName"})," (string): Service name to use that will be used in all log statements. Defaults to ",(0,a.jsx)(t.code,{children:"service_undefined"}),"."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"defaultNamespace"})," (string): Default namespace to use for all metrics. Defaults to ",(0,a.jsx)(t.code,{children:"default_namespace"}),"."]}),"\n"]}),"\n",(0,a.jsx)(t.p,{children:"Middleware accepts the following options:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"metrics"})," (Metric) (required): An instance of the Metrics class."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"option"})," (object) (optional): An object with the following keys:","\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"throwOnEmptyMetrics"})," (boolean) (optional): Whether to throw an error if no metrics were added. Defaults to ",(0,a.jsx)(t.code,{children:"false"}),"."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"captureColdStartMetric"})," (boolean) (optional): Whether to capture the cold start metric. Defaults to ",(0,a.jsx)(t.code,{children:"true"}),"."]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,a.jsx)(t.h3,{id:"sample-usage-2",children:"Sample usage"}),"\n",(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core';\nimport { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';\nimport { logMetrics } from '@aws-lambda-powertools/metrics/middleware';\n\nconst metrics = new Metrics({\n  namespace: 'serverlessAirline',\n  serviceName: 'orders'\n});\n\nconst lambdaHandler = async (_event: unknown, _context: unknown): Promise<void> => {\n  metrics.addMetric('successfulBooking', MetricUnits.Count, 1);\n};\n\nexport const handler = middy(lambdaHandler)\n  .use(logMetrics(metrics));\n"})}),"\n",(0,a.jsx)(t.p,{children:"The above code will output a CloudWatch EMF object similar to the following:"}),"\n",(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-json",children:'{\n  "successfulBooking": 1.0,\n  "_aws": {\n    "Timestamp": 1592234975665,\n    "CloudWatchMetrics": [{\n      "Namespace": "successfulBooking",\n      "Dimensions": [\n        [ "service" ]\n      ],\n      "Metrics": [{\n        "Name": "successfulBooking",\n        "Unit": "Count"\n      }]\n    }],\n    "service": "orders"\n  }\n}\n'})}),"\n",(0,a.jsx)(t.p,{children:"This EMF object will be sent to CloudWatch asynchronously by the CloudWatch service. You do not need any custom stacks, and there is no impact to Lambda function latency."}),"\n",(0,a.jsxs)(t.p,{children:["The Metrics utility supports ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#adding-high-resolution-metrics",children:"high-resolution metrics"})," as well as ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#adding-multi-value-metrics",children:"multi-value metrics"}),". It also allows you to add ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#adding-default-dimensions",children:"default dimensions"})," that are used in all the metrics emitted by your application or ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#single-metric-with-different-dimensions",children:"create a one-off metric"})," with different dimensions."]}),"\n",(0,a.jsx)(t.h2,{id:"idempotency",children:"Idempotency"}),"\n",(0,a.jsx)(t.p,{children:"Key features:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsx)(t.li,{children:"Prevent Lambda handler from executing more than once on the same event payload during a time window"}),"\n",(0,a.jsx)(t.li,{children:"Ensure Lambda handler returns the same result when called with the same payload"}),"\n",(0,a.jsx)(t.li,{children:"Select a subset of the event as the idempotency key using JMESPath expressions"}),"\n",(0,a.jsx)(t.li,{children:"Set a time window in which records with the same payload should be considered duplicates"}),"\n",(0,a.jsx)(t.li,{children:"Expires in-progress executions if the Lambda function times out halfway through"}),"\n"]}),"\n",(0,a.jsx)(t.p,{children:"The property of idempotency means that an operation does not cause additional side effects if it is called more than once with the same input parameters. Idempotent operations will return the same result when they are called multiple times with the same parameters. This makes idempotent operations safe to retry."}),"\n",(0,a.jsx)(t.h3,{id:"install-3",children:"Install"}),"\n",(0,a.jsxs)(r.Z,{groupId:"npm2yarn",children:[(0,a.jsx)(o.Z,{value:"npm",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"npm install --save @aws-lambda-powertools/idempotency @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb\n"})})}),(0,a.jsx)(o.Z,{value:"yarn",label:"Yarn",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"yarn add @aws-lambda-powertools/idempotency @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb\n"})})}),(0,a.jsx)(o.Z,{value:"pnpm",label:"pnpm",children:(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-bash",children:"pnpm add @aws-lambda-powertools/idempotency @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb\n"})})})]}),"\n",(0,a.jsx)(t.h3,{id:"options-3",children:"Options"}),"\n",(0,a.jsx)(t.p,{children:"Middleware accepts the following options:"}),"\n",(0,a.jsxs)(t.ul,{children:["\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"persistenceStore"})," (",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/api/classes/_aws_lambda_powertools_idempotency.persistence.BasePersistenceLayer.html",children:(0,a.jsx)(t.code,{children:"BasePersistenceLayer"})}),"): Class used to interact with a ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/idempotency/#persistence-layers",children:"persistence store"}),"."]}),"\n",(0,a.jsxs)(t.li,{children:[(0,a.jsx)(t.code,{children:"config"})," (",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/api/classes/_aws_lambda_powertools_idempotency.index.IdempotencyConfig.html",children:(0,a.jsx)(t.code,{children:"IdempotencyConfig"})}),") (optional): Configuration object to customize the ",(0,a.jsx)(t.a,{href:"https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/idempotency/#customizing-the-default-behavior",children:"default behavior"})," of the idempotency feature."]}),"\n"]}),"\n",(0,a.jsx)(t.h3,{id:"sample-usage-3",children:"Sample usage"}),"\n",(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core';\nimport { randomUUID } from 'node:crypto';\nimport { makeHandlerIdempotent } from '@aws-lambda-powertools/idempotency/middleware';\nimport { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';\n\nconst persistenceStore = new DynamoDBPersistenceLayer({\n  tableName: 'idempotencyTableName',\n});\n\nconst createSubscriptionPayment = async (\n  event\n) => {\n  // ... create payment\n  return {\n    id: randomUUID(),\n    productId: event.productId,\n  };\n};\n\nexport const handler = middy(\n  async (event, _context) => {\n    try {\n      const payment = await createSubscriptionPayment(event);\n\n      return {\n        paymentId: payment.id,\n        message: 'success',\n        statusCode: 200,\n      };\n    } catch (error) {\n      throw new Error('Error creating payment');\n    }\n  }\n).use(\n  makeHandlerIdempotent({\n    persistenceStore,\n  })\n);\n"})}),"\n",(0,a.jsx)(t.h2,{id:"best-practices",children:"Best practices"}),"\n",(0,a.jsx)(t.h3,{id:"using-multiple-utilities",children:"Using multiple utilities"}),"\n",(0,a.jsx)(t.p,{children:"You can use multiple Powertools utilities in your Lambda function by chaining the respective middlewares together. When doing so the Powertools team recommends that you place the Tracer middleware at the top of the middleware chain, followed by the Logger and any other middlewares."}),"\n",(0,a.jsx)(t.p,{children:"This is because the Tracer middleware will create a new segment for each Lambda invocation, and the Logger might want to log the event that triggered the Lambda invocation. With this placement you will be able to have a segment that closely matches the actual duration of your Lambda function, and you will be able to see the event that triggered the function invocation before it's potentially modified by other middlewares."}),"\n",(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-javascript",children:"export const handler = middy(() => { /* ... */ })\n  .use(captureLambdaHandler(tracer))\n  .use(injectLambdaContext(logger, { logEvent: true }))\n  .use(logMetrics(metrics, { captureColdStartMetric: true }));\n"})}),"\n",(0,a.jsx)(t.h3,{id:"cleaning-up-on-early-returns",children:"Cleaning up on early returns"}),"\n",(0,a.jsxs)(t.p,{children:["As discussed in the ",(0,a.jsx)(t.a,{href:"/docs/intro/early-interrupt",children:"early return section"}),", some middlewares might need to stop the whole execution flow and return a response immediately. In this case, if you are writing your own middleware that will work with the Powertools utilities, you must make sure to clean up the utilities before returning."]}),"\n",(0,a.jsxs)(t.p,{children:["For example, if you are using the Tracer utility, you must make sure to call the ",(0,a.jsx)(t.code,{children:"close"})," method so that the Tracer can properly close the current segment and send it to X-Ray. Likewise, if you are using the Metrics utility, it's a good practice to call the ",(0,a.jsx)(t.code,{children:"clearMetrics"})," method so that the Metrics utility can emit the metrics that were stored in the buffer and avoid you losing any data."]}),"\n",(0,a.jsx)(t.p,{children:"Following the example described in the linked section, you can clean up all the utilities by doing the following:"}),"\n",(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-javascript",children:"import { cleanupMiddlewares } from '@aws-lambda-powertools/commons';\n\n// some function that calculates the cache id based on the current event\nconst calculateCacheId = (event) => {\n  /* ... */\n}\nconst storage = {}\n\n// middleware\nconst cacheMiddleware = (options) => {\n  let cacheKey\n\n  const cacheMiddlewareBefore = async (request) => {\n    cacheKey = options.calculateCacheId(request.event)\n    if (options.storage.hasOwnProperty(cacheKey)) {\n      // clean up the Powertools utilities before returning\n      cleanupMiddlewares()\n\n      // exits early and returns the value from the cache if it's already there\n      return options.storage[cacheKey]\n    }\n  }\n\n  const cacheMiddlewareAfter = async (request) => {\n    // stores the calculated response in the cache\n    options.storage[cacheKey] = request.response\n  }\n\n  return {\n    before: cacheMiddlewareBefore,\n    after: cacheMiddlewareAfter\n  }\n}\n\n// sample usage\nconst handler = middy((event, context) => {\n  /* ... */\n})\n.use(captureLambdaHandler(tracer))\n.use(injectLambdaContext(logger, { logEvent: true }))\n.use(logMetrics(metrics, { captureColdStartMetric: true }))\n.use(\n  cacheMiddleware({\n    calculateCacheId,\n    storage\n  })\n);\n"})})]})}function m(e={}){const{wrapper:t}={...(0,s.a)(),...e.components};return t?(0,a.jsx)(t,{...e,children:(0,a.jsx)(u,{...e})}):u(e)}},5162:(e,t,n)=>{n.d(t,{Z:()=>o});n(7294);var a=n(6010);const s={tabItem:"tabItem_Ymn6"};var r=n(5893);function o(e){let{children:t,hidden:n,className:o}=e;return(0,r.jsx)("div",{role:"tabpanel",className:(0,a.Z)(s.tabItem,o),hidden:n,children:t})}},4866:(e,t,n)=>{n.d(t,{Z:()=>v});var a=n(7294),s=n(6010),r=n(2466),o=n(6550),i=n(469),l=n(1980),c=n(7392),d=n(12);function h(e){return a.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,a.isValidElement)(e)&&function(e){const{props:t}=e;return!!t&&"object"==typeof t&&"value"in t}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function u(e){const{values:t,children:n}=e;return(0,a.useMemo)((()=>{const e=t??function(e){return h(e).map((e=>{let{props:{value:t,label:n,attributes:a,default:s}}=e;return{value:t,label:n,attributes:a,default:s}}))}(n);return function(e){const t=(0,c.l)(e,((e,t)=>e.value===t.value));if(t.length>0)throw new Error(`Docusaurus error: Duplicate values "${t.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[t,n])}function m(e){let{value:t,tabValues:n}=e;return n.some((e=>e.value===t))}function p(e){let{queryString:t=!1,groupId:n}=e;const s=(0,o.k6)(),r=function(e){let{queryString:t=!1,groupId:n}=e;if("string"==typeof t)return t;if(!1===t)return null;if(!0===t&&!n)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return n??null}({queryString:t,groupId:n});return[(0,l._X)(r),(0,a.useCallback)((e=>{if(!r)return;const t=new URLSearchParams(s.location.search);t.set(r,e),s.replace({...s.location,search:t.toString()})}),[r,s])]}function g(e){const{defaultValue:t,queryString:n=!1,groupId:s}=e,r=u(e),[o,l]=(0,a.useState)((()=>function(e){let{defaultValue:t,tabValues:n}=e;if(0===n.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(t){if(!m({value:t,tabValues:n}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${t}" but none of its children has the corresponding value. Available values are: ${n.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return t}const a=n.find((e=>e.default))??n[0];if(!a)throw new Error("Unexpected error: 0 tabValues");return a.value}({defaultValue:t,tabValues:r}))),[c,h]=p({queryString:n,groupId:s}),[g,x]=function(e){let{groupId:t}=e;const n=function(e){return e?`docusaurus.tab.${e}`:null}(t),[s,r]=(0,d.Nk)(n);return[s,(0,a.useCallback)((e=>{n&&r.set(e)}),[n,r])]}({groupId:s}),f=(()=>{const e=c??g;return m({value:e,tabValues:r})?e:null})();(0,i.Z)((()=>{f&&l(f)}),[f]);return{selectedValue:o,selectValue:(0,a.useCallback)((e=>{if(!m({value:e,tabValues:r}))throw new Error(`Can't select invalid tab value=${e}`);l(e),h(e),x(e)}),[h,x,r]),tabValues:r}}var x=n(2389);const f={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var j=n(5893);function b(e){let{className:t,block:n,selectedValue:a,selectValue:o,tabValues:i}=e;const l=[],{blockElementScrollPositionUntilNextRender:c}=(0,r.o5)(),d=e=>{const t=e.currentTarget,n=l.indexOf(t),s=i[n].value;s!==a&&(c(t),o(s))},h=e=>{let t=null;switch(e.key){case"Enter":d(e);break;case"ArrowRight":{const n=l.indexOf(e.currentTarget)+1;t=l[n]??l[0];break}case"ArrowLeft":{const n=l.indexOf(e.currentTarget)-1;t=l[n]??l[l.length-1];break}}t?.focus()};return(0,j.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,s.Z)("tabs",{"tabs--block":n},t),children:i.map((e=>{let{value:t,label:n,attributes:r}=e;return(0,j.jsx)("li",{role:"tab",tabIndex:a===t?0:-1,"aria-selected":a===t,ref:e=>l.push(e),onKeyDown:h,onClick:d,...r,className:(0,s.Z)("tabs__item",f.tabItem,r?.className,{"tabs__item--active":a===t}),children:n??t},t)}))})}function y(e){let{lazy:t,children:n,selectedValue:s}=e;const r=(Array.isArray(n)?n:[n]).filter(Boolean);if(t){const e=r.find((e=>e.props.value===s));return e?(0,a.cloneElement)(e,{className:"margin-top--md"}):null}return(0,j.jsx)("div",{className:"margin-top--md",children:r.map(((e,t)=>(0,a.cloneElement)(e,{key:t,hidden:e.props.value!==s})))})}function w(e){const t=g(e);return(0,j.jsxs)("div",{className:(0,s.Z)("tabs-container",f.tabList),children:[(0,j.jsx)(b,{...e,...t}),(0,j.jsx)(y,{...e,...t})]})}function v(e){const t=(0,x.Z)();return(0,j.jsx)(w,{...e,children:h(e.children)},String(t))}},1151:(e,t,n)=>{n.d(t,{Z:()=>i,a:()=>o});var a=n(7294);const s={},r=a.createContext(s);function o(e){const t=a.useContext(r);return a.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function i(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),a.createElement(r.Provider,{value:t},e.children)}}}]);
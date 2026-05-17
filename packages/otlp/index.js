// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { diag, metrics, trace } from "@opentelemetry/api";
import {
	detectResources,
	envDetector,
	processDetector,
} from "@opentelemetry/resources";

// import {containerDetector,} from'@opentelemetry/resource-detector-container'

// import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
// import { AWSXRayLambdaPropagator } from "@opentelemetry/propagator-aws-xray-lambda";
// import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { awsLambdaDetector } from "@opentelemetry/resource-detector-aws";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import {
	BatchSpanProcessor,
	NodeTracerProvider,
} from "@opentelemetry/sdk-trace-node";

export { StdoutExporter } from "./stdoutExporter.js";

export const initResource = (opts) => {
	const { detectors = [] } = opts;
	const resource = detectResources({
		detectors: [awsLambdaDetector, envDetector, processDetector, ...detectors],
	});
	return resource;
};

export const initLogger = (opts) => {
	const { exporter } = opts;
	diag.setLogger(exporter);
	return diag;
};

export const initMetrics = (opts) => {
	const { readers = [] } = opts;
	const meterProvider = new MeterProvider({ readers });
	// for (let i = 0, l = exporters.length; i < l; i++) {
	// 	meterProvider.addExporter(exporters[i]);
	// }
	metrics.setGlobalMeterProvider(meterProvider);
	return metrics;
};

export const initTracer = (opts) => {
	const { resource, exporters = [], instrumentations = [], propagator } = opts;

	const spanProcessors = [];
	for (let i = 0, l = exporters.length; i < l; i++) {
		spanProcessors.push(new BatchSpanProcessor(exporters[i]));
	}
	const provider = new NodeTracerProvider({
		resource,
		spanProcessors,
	});
	// Move to docs
	// const propogator = propagators.length
	//   ? new CompositePropagator({ propagators })
	//   : undefined;
	provider.register({ propagator });

	registerInstrumentations({ instrumentations });

	return trace.getTracer("lambda");
};

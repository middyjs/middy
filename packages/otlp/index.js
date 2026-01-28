import { hrtime, stderr, stdout } from "node:process";
import { context, diag, metrics, trace } from "@opentelemetry/api";
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
	const { meter, exporters = [] } = opts;
	const meterProvider = new MeterProvider(meter);
	for (let i = 0, l = exporters.length; i < l; i++) {
		meterProvider.addExporter(exporters[i]);
	}
	metrics.setGlobalMeterProvider(meterProvider);
	return metrics;
};

export const initTracer = (opts) => {
	const { exporters = [], instrumentations = [], propagator } = opts;

	const spanProcessors = [];
	for (let i = 0, l = exporters.length; i < l; i++) {
		spanProcessors.push(new BatchSpanProcessor(exporters[i]));
	}
	const provider = new NodeTracerProvider({
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

export class StdoutExporter {
	export(logRecords, resultCallback) {
		logRecords.forEach((logRecord) => {
			if (logRecord.SeverityText === "ERROR") {
				stderr.write(`${JSON.stringify(logRecord)}\n`);
			} else {
				stdout.write(`${JSON.stringify(logRecord)}\n`);
			}
		});

		resultCallback({ code: 0 }); // `0` means success
	}

	// Logger only
	log(severityText, severityNumber) {
		return (...args) => {
			// TODO support stream
			for (let i = args.length; i--; ) {
				const arg = args[i];
				if (arg instanceof Error) {
					args[i] = {
						message: arg.toString(),
						trace: arg.trace,
						cause: arg.cause,
					};
				}
			}

			const body = args.length > 1 ? args : args[0];
			const currentContext = Object.fromEntries(
				context.active()._currentContext,
			);
			this.export(
				[
					{
						// https://opentelemetry.io/docs/specs/otel/logs/data-model
						Timestamp: hrtime.bigint().toString(),
						SeverityText: severityText,
						SeverityNumber: severityNumber,
						Body: body,
						Attributes: currentContext.attributes,
					},
				],
				() => {},
			);
		};
	}

	verbose = this.log("TRACE", 1);
	debug = this.log("DEBUG", 5);
	info = this.log("INFO", 9);
	warn = this.log("WARN", 13);
	error = this.log("ERROR", 17);
}

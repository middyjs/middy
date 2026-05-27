// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { hrtime, stderr, stdout } from "node:process";
import { context } from "@opentelemetry/api";
import { hrTime } from "@opentelemetry/core";

export class StdoutExporter {
	export(logRecords, resultCallback) {
		logRecords.forEach((logRecord) => {
			if (logRecord.SeverityText === "ERROR") {
				stderr.write(`${JSON.stringify(logRecord)}\n`);
			} else {
				stdout.write(`${JSON.stringify(logRecord)}\n`);
			}
		});

		resultCallback({ code: 0 });
	}

	log(severityText, severityNumber) {
		return (...args) => {
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
						Timestamp: hrTime(),
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

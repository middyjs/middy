// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

interface LogRecord {
	Timestamp: string;
	SeverityText: string;
	SeverityNumber: number;
	Body: any;
	Attributes?: Record<string, any>;
}

interface ExportResult {
	code: number;
}

export declare class StdoutExporter {
	export(
		logRecords: LogRecord[],
		resultCallback: (result: ExportResult) => void,
	): void;
	verbose: (...args: any[]) => void;
	debug: (...args: any[]) => void;
	info: (...args: any[]) => void;
	warn: (...args: any[]) => void;
	error: (...args: any[]) => void;
}

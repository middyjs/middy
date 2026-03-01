import { StdoutExporter } from "./StdoutExporter.js";
export class MockExporter extends StdoutExporter {
	constructor(t) {
		super();
		this.test = t.mock.fn();
	}
	export(logRecords, resultCallback) {
		logRecords.forEach((logRecord) => {
			this.test(logRecord);
		});

		resultCallback({ code: 0 }); // `0` means success
	}
}

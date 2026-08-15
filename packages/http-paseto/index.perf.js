import { createPublicKey } from "node:crypto";
import { V4 } from "paseto";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import httpPaseto from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const defaultContext = { getRemainingTimeInMillis: () => 30000 };

const privateKey = await V4.generateKey("public");
const publicKey = createPublicKey(privateKey);
const spkiDer = publicKey.export({ type: "spki", format: "der" });
const pubBytes = new Uint8Array(spkiDer);
const token = await V4.sign({ sub: "user-1" }, privateKey, {
	expiresIn: "1h",
});

const setupHandler = () =>
	middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = pubBytes;
		})
		.use(httpPaseto({ internalKey: "pubKey" }));

const warmHandler = setupHandler();

await bench
	.add("verify v4.public token", async () => {
		await warmHandler(
			{ headers: { authorization: `Bearer ${token}` } },
			defaultContext,
		);
	})

	.run();

console.table(bench.table());

import { Bench } from "tinybench";
import middy from "../core/index.js";
import httpX402 from "./index.js";

class MockFacilitatorClient {
	async verify() {
		return { isValid: true, payer: "0xpayer" };
	}
	async settle() {
		return {
			success: true,
			payer: "0xpayer",
			transaction: "0xtx",
			network: "eip155:8453",
		};
	}
}

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

const setupHandler = () =>
	middy(() => ({ statusCode: 200, body: "ok", headers: {} })).use(
		httpX402({
			price: 0.001,
			payTo: "0xpayto",
			asset: "0xasset",
			// v1 acceptance is opt-in as of v8 (see index.js default `versions`);
			// keep both versions enabled here so the v1 benchmark still exercises
			// the full verify+settle round trip instead of the cheap
			// "unsupported version" reject.
			versions: [1, 2],
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

const warmHandler = setupHandler();

const paymentHeader = Buffer.from(
	JSON.stringify({
		x402Version: 2,
		accepted: {
			scheme: "exact",
			network: "eip155:8453",
			amount: "1000",
			asset: "0xasset",
			payTo: "0xpayto",
			maxTimeoutSeconds: 60,
		},
		payload: { signature: "0xsig", authorization: {} },
	}),
).toString("base64");

const paymentHeaderV1 = Buffer.from(
	JSON.stringify({
		x402Version: 1,
		scheme: "exact",
		network: "eip155:8453",
		payload: { signature: "0xsig", authorization: {} },
	}),
).toString("base64");

const paidEvent = { headers: { "payment-signature": paymentHeader } };
const paidEventV1 = { headers: { "x-payment": paymentHeaderV1 } };
const unpaidEvent = { headers: {} };

await bench
	.add("Payment Required (402)", async () => {
		try {
			await warmHandler(unpaidEvent, defaultContext);
		} catch (_e) {}
	})
	.add("Verify and Settle", async () => {
		try {
			await warmHandler(paidEvent, defaultContext);
		} catch (_e) {}
	})
	.add("Verify and Settle (v1)", async () => {
		try {
			await warmHandler(paidEventV1, defaultContext);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());

import { bench, suite } from "node:bench";
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

const options = { warmup: 10, samples: 30 };
const ops = 100;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

const setupHandler = () =>
	middy(() => ({ statusCode: 200, body: "ok", headers: {} })).use(
		httpX402({
			price: 0.001,
			payTo: "0xpayto",
			asset: "0xasset",
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

suite("http-x402", () => {
	bench("Payment Required (402)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(unpaidEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("Verify and Settle", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(paidEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("Verify and Settle (v1)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(paidEventV1, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});

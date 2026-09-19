import { bench } from "node:bench";
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

const operations = 1_000;

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

const pay = (event) => async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(event, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
};

bench("http-x402: Payment Required (402)", pay(unpaidEvent));
bench("http-x402: Verify and Settle", pay(paidEvent));
bench("http-x402: Verify and Settle (v1)", pay(paidEventV1));

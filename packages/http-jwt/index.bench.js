import { bench, suite } from "node:bench";
import { SignJWT } from "jose";
import middy from "../core/index.js";
import httpJwt from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 100;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

const secret = "super-secret-key-for-perf-benchmark-1234";
const secretBuffer = Buffer.from(secret);

const token = await new SignJWT({ sub: "perf-user", role: "admin" })
	.setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
	.setIssuedAt()
	.setExpirationTime("1h")
	.sign(secretBuffer);

const setupHandler = () =>
	middy(() => {})
		.before((request) => {
			request.internal.hmacKey = secret;
		})
		.use(httpJwt({ internalKey: "hmacKey", algorithm: "HS256" }));

const warmHandler = setupHandler();
const event = { headers: { authorization: `Bearer ${token}` } };

suite("http-jwt", () => {
	bench("Verify HS256 JWT via internalKey", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});

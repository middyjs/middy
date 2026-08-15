import { SignJWT } from "jose";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import httpJwt from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

const secret = "super-secret-key-for-perf-benchmark-1234";
const secretBuffer = Buffer.from(secret);

const token = await new SignJWT({ sub: "perf-user", role: "admin" })
	.setProtectedHeader({ alg: "HS256" })
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

await bench
	.add("Verify HS256 JWT via internalKey", async () => {
		try {
			await warmHandler(event, defaultContext);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());

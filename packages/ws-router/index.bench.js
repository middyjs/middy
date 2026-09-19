import { bench } from "node:bench";
import middy from "../core/index.js";
import router from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const handler = () => {};
	return middy(
		router([
			{ routeKey: "$connect", handler },
			{ routeKey: "$disconnect", handler },
			{ routeKey: "$default", handler },
		]),
	);
};

const warmHandler = setupHandler();

const route = (routeKey) => async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler({ requestContext: { routeKey } }, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
};

bench("ws-router: hit $connect", route("$connect"));
bench("ws-router: hit $default", route("$default"));
bench("ws-router: miss", route("missing"));

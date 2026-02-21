//import { stderr } from "node:process"; // CloudFlare doesn't support
import { NIL as uuidNil } from "uuid";

export async function handleError({ error, event }) {
	console.error(
		`${JSON.stringify({
			log_level: "ERROR",
			message: error.message,
			stack: error.stack,
			cause: error.cause,
			status_code: error.statusCode ?? null,
			request_id: uuidNil,
			event, // TODO need to remove sensitive data before logging (ip, user agent, )
		})}\n`,
	);
}

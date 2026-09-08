//import { stderr } from "node:process"; // CloudFlare doesn't support

// RFC 9562 nil UUID, used when the request carries no cf-ray header (local dev).
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// Never log the whole RequestEvent: on Cloudflare it carries `platform.env`
// (secret bindings), `platform.cf`, cookies and client details.
export async function handleError({ error, event, status, message }) {
	console.error(
		`${JSON.stringify({
			log_level: "ERROR",
			message: error?.message ?? message,
			stack: error?.stack,
			status_code: status,
			request_id: event.request.headers.get("cf-ray") ?? NIL_UUID,
			path: event.url.pathname,
			route_id: event.route.id,
		})}\n`,
	);
}

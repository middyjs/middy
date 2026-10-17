import { sequence } from "@sveltejs/kit/hooks";
import applyCacheControlMiddleware from "@willfarrell-ds/svelte/hooks/applyCacheControlMiddleware.js";
import removeCommentsMiddleware from "@willfarrell-ds/svelte/hooks/removeCommentsMiddleware.js";
import removeDuplicateImportMiddleware from "@willfarrell-ds/svelte/hooks/removeDuplicateImportMiddleware.js";
import removeOnEventsMiddleware from "@willfarrell-ds/svelte/hooks/removeOnEventsMiddleware.js";
import tardisecMiddleware from "#hooks/tardisecMiddleware.js";

export { handleError } from "#hooks/handleError.js";

export const handle = sequence(
	applyCacheControlMiddleware,
	tardisecMiddleware,
	removeCommentsMiddleware,
	removeOnEventsMiddleware,
	removeDuplicateImportMiddleware,
);

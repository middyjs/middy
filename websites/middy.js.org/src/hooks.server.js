import applyCacheControlMiddleware from "@design-system/hooks/applyCacheControlMiddleware.js";
import removeCommentsMiddleware from "@design-system/hooks/removeCommentsMiddleware.js";
import removeDuplicateImportMiddleware from "@design-system/hooks/removeDuplicateImportMiddleware.js";
import removeOnEventsMiddleware from "@design-system/hooks/removeOnEventsMiddleware.js";
import tardisecMiddleware from "@hooks/tardisecMiddleware.js";
import { sequence } from "@sveltejs/kit/hooks";

export { handleError } from "@hooks/handleError.js";

export const handle = sequence(
	applyCacheControlMiddleware,
	tardisecMiddleware,
	removeCommentsMiddleware,
	removeOnEventsMiddleware,
	removeDuplicateImportMiddleware,
);

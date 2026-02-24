// import localeMiddleware from "@hooks/localeMiddleware.js";
import httpHeadersMiddleware from "@hooks/httpHeadersMiddleware.js";
import removeCommentsMiddleware from "@hooks/removeCommentsMiddleware.js";
import removeDuplicateImportMiddleware from "@hooks/removeDuplicateImportMiddleware.js";
import removeOnEventsMiddleware from "@hooks/removeOnEventsMiddleware.js";
import tardisecMiddleware from "@hooks/tardisecMiddleware.js";
import { sequence } from "@sveltejs/kit/hooks";

// export {init} from '@hooks/init.js'
export { handleError } from "@hooks/handleError.js";

export const handle = sequence(
	// localeMiddleware,
	httpHeadersMiddleware,
	tardisecMiddleware,
	removeCommentsMiddleware,
	removeOnEventsMiddleware,
	removeDuplicateImportMiddleware,
);

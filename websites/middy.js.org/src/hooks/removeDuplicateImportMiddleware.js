const importRegExp =
	/<(script|link)([^>]+)(src|href)=["']([^"']+)["']([^>]*)>/gi;
const removeDuplicateImportMiddleware = async ({ event, resolve }) => {
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => {
			const matches = html.match(importRegExp).sort();

			let previous = "";
			for (let i = matches.length; i--; ) {
				const match = matches[i];
				if (match === previous) {
					html = html.replace(previous, "");
				}
				previous = match;
			}

			return html;
		},
	});
	return response;
};

export default removeDuplicateImportMiddleware;

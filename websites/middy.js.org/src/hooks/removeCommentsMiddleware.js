const commentRegExp = /<!--[[\]!a-z0-9]*-->\n*/g;

const removeCommentsMiddleware = async ({ event, resolve }) => {
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => {
			return html.replace(commentRegExp, "");
		},
	});
	return response;
};
export default removeCommentsMiddleware;

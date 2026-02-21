const oneventRegExp = /on[a-z]+=["]this\.__e=event["]/g;

const removeOnEventsMiddleware = async ({ event, resolve }) => {
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => {
			return html.replace(oneventRegExp, "");
		},
	});
	return response;
};
export default removeOnEventsMiddleware;

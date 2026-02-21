const httpHeadersMiddleware = async ({ event, resolve }) => {
	// const { url, params, cookies } = event;

	//let {domain} = domainParse(new URL(url).hostname)

	const response = await resolve(event);

	if (cookies.getAll().length) {
		response.headers.set("Cache-Control", "no-cache");
	} else {
		response.headers.set(
			"Cache-Control",
			"max-age=60, stale-if-error=300, stale-while-revalidate=31536000",
		);
	}

	return response;
};

export default httpHeadersMiddleware;

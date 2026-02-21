// Used for passing scan results to SSR
export const transport = {
	Error: {
		encode: (value) => value instanceof Error && value.message,
		decode: (message) => new Error(message),
	},
};

export default {
	plugins: [
		// 1. Minify the path data (the "d" attribute)
		"convertPathData",
		// 2. Remove comments
		"removeComments",
		// 3. Remove metadata/editors junk
		"removeMetadata",
		"removeEditorsNSData",
		// 4. Clean up attributes but DO NOT touch IDs or Symbols
		"removeUnknownsAndDefaults",
		"removeUnusedNS",
	],
};

// Mutation testing. Coverage proves the tests EXECUTE the code; mutation testing
// proves the tests would FAIL if the code were wrong. Stryker copies the project
// to a sandbox, applies one source mutation at a time (e.g. `return true` ->
// `return false`), and re-runs the suite. A mutant that survives a green suite is
// an assertion the tests never make.
//
// One config, two modes:
//   npm run test:mutation                          mutate every package
//   MUTATE_PACKAGE=http-cors npm run test:mutation  mutate just that package
//
// CI fans out per package via a matrix that sets MUTATE_PACKAGE.
const pkg = process.env.MUTATE_PACKAGE;
const base = pkg ? `packages/${pkg}` : "packages";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
	packageManager: "npm",
	testRunner: "command",
	commandRunner: {
		command: `node --no-warnings=ExperimentalWarning --test --experimental-test-module-mocks ./${base}/**/*.test.js`,
	},
	// The command runner re-runs the whole suite per mutant, so per-test coverage
	// analysis is unavailable.
	coverageAnalysis: "off",
	mutate: [
		`${base}/**/*.js`,
		`!${base}/**/*.test.js`,
		`!${base}/**/*.perf.js`,
		`!${base}/**/*.fuzz.js`,
		"!**/node_modules/**",
	],
	plugins: ["@stryker-mutator/*"],
	reporters: ["progress", "clear-text"],
	thresholds: { high: 100, low: 100, break: 100 },
	tempDirName: ".stryker-tmp",
	cleanTempDir: true,
};

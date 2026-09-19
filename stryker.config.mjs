// Mutation testing. Coverage proves the tests EXECUTE the code; mutation testing
// proves the tests would FAIL if the code were wrong. Stryker copies the project
// to a sandbox, applies one source mutation at a time (e.g. `return true` ->
// `return false`), and re-runs the suite. A mutant that survives a green suite is
// an assertion the tests never make.
//
// One config, one stryker process, two modes:
//   npm run test:mutation                           mutate every package
//   MUTATE_PACKAGE=http-cors npm run test:mutation  mutate just that package
//
// CI (test-mutation.yml) runs one matrix job per package with MUTATE_PACKAGE
// set, so each stryker process mutates a single package. Running with no
// MUTATE_PACKAGE mutates every package in one process.
const pkg = process.env.MUTATE_PACKAGE;
const base = pkg ? `packages/${pkg}` : "packages";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
	packageManager: "npm",
	testRunner: "command",
	commandRunner: {
		command: `node --no-warnings=ExperimentalWarning --test --experimental-test-module-mocks ./${base}/**/*.test.js`,
	},
	coverageAnalysis: "off",
	mutate: [
		`${base}/**/*.js`,
		`!${base}/**/*.test.js`,
		`!${base}/**/*.bench.js`,
		`!${base}/**/*.fuzz.js`,
	],
	incremental: true,
	incrementalFile: pkg
		? `/tmp/stryker/@middy/${pkg}/incremental.json`
		: "/tmp/stryker/@middy/incremental.json",
	plugins: ["@stryker-mutator/*"],
	reporters: ["progress", "clear-text"],
	thresholds: { high: 100, low: 100, break: 100 },
	tempDirName: pkg ? `/tmp/stryker/@middy/${pkg}` : "/tmp/stryker/@middy",
};

module.exports = {
	extends: ["@commitlint/config-conventional"],
	rules: {
		// DCO: `git commit -s`; also enforced in CI by `Tests (dco)` and the DCO app
		"signed-off-by": [2, "always", "Signed-off-by:"],
	},
};

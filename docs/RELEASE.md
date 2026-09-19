# How to draft and publish a new release

For **maintainers** only.

This document explains what are the necessary steps to draft a new release and publish it on NPM and GitHub.

## Concepts

Middy is managed as a monorepo. This means that Middy core package and all the official middlewares are developed using the same repository.

By design, new releases keeps all the package versions in sync. For instance, if we are to release v1.2.3, this means that EVERY package needs to be bumped to v1.2.3 and that EVERY package will be published.

This particular design has few important implications:

- Every time a new version is released, all the packages are version bumped (to the same version), regardless if a given package was subject to change or not.
- This gives the users the confidence that dependent packages are always tested together and that, in a given project using middy, they can all be easily version bumped all together. The goal is to avoid the users the hassle to having to deal with complex compatibility matrices.

## Draft a new release

At a given point in time, if you want to draft a new release, you need to follow a specific sequence of actions, as described in the following sections:

### 0. Pick a version number

- Versioning should follow [semantic versioning](https://semver.org/) which, in short, means:
  - Versions numbers use the format `X.Y.Z` where `X` is called "major", Y is called "minor" and `Z` is called "patch".
  - If the new releases fixes bugs in a backward compatible way, only the "patch" fragment should be bumped.
  - If you are adding a new feature in a backward compatible way, "minor" should be bumped and "patch" should be reset to `0`.
  - If you are providing any breaking change, you should bump "major" and reset to `0` both "minor" and "patch".
  - You can optionally have suffixes such as `-alpha` or `-beta` for pre-releases of upcoming major versions.
  - If you need to have multiple versions of pre-releases, those should have a `.X` suffix, where `X` is an increasing number (e.g. `1.0.0-beta.15`).

### 1. Prepare release

- Work lands on `develop` through pull requests; a release is the merge of `develop` into `main`. Nothing is committed to `main` directly, and the `main` ruleset requires two approving reviews, CODEOWNERS review and every status check in [.github/rulesets/main.json](../.github/rulesets/main.json).
- Do the version bump on `develop`, or on a `release/X.Y.Z` branch off `develop` when it needs several commits or a review before it lands there.
- `develop` moves to the next version as soon as a release is cut (it is `8.0.0-alpha.0` now), so a patch for a shipped line does not start from `develop`. It lands on that line's maintenance branch (`7.x`), see [Maintenance releases](#maintenance-releases).

### 2. Version bump

- Update the `version` field of the main [`package.json`](../package.json) with the new version.
- Run the command `npm run release:sync` to make sure every package will have the same version. It also pins every internal `@middy/*` dependency to that version and regenerates `package-lock.json`; commit the lockfile with the bump, because the Build job fails when a workspace resolves `@middy/*` from the registry instead of the workspace.
- Commit all the changes so far.

### 3. Publish release on GitHub

- Open a pull request from `develop` (or the release branch) to `main` and merge it. The merge triggers [release.yml](../.github/workflows/release.yml) because `package.json` changed.
- The Release job drafts a [GitHub release](https://github.com/middyjs/middy/releases) whose tag is the version, without a `v` prefix, with generated notes. A draft creates no tag, so leave it unpublished until the npm release is approved (step 4).
- Then create the signed tag on the merge commit, push it, and publish the draft:

  ```bash
  git checkout main && git pull
  npm run release:tag   # git tag -s -m <version> <version>
  git push origin <version>
  ```

  Review the generated notes before publishing. A release published against an existing tag reuses it, so the release points at the signed tag instead of the lightweight one GitHub would otherwise create. The `version` ruleset protects tags from deletion and force-update.

### 4. Publish release on NPM (staged)

Publishing is two-phase: CI stages, a maintainer approves.

1. [release.yml](../.github/workflows/release.yml) runs build -> GitHub release -> publish. The Build job runs each workspace's `build` script (today only `rds`, which fetches the certificate modules `npm ci --ignore-scripts` skips), refuses to pack unless every workspace carries the root version, `package-lock.json` links every `@middy/*` dependency to its workspace and `packages/rds/certificates` holds at least 35 modules, then copies the root `LICENSE` into each package directory (gitignored) so every tarball ships it. Approve the `npm-publish` environment when the Publish job requests review.
2. The Publish job verifies the provenance attestation of every tarball, then runs `npm stage publish` for each one under the dist-tag the Build job chose (see [Dist-tags](#dist-tags)) and fails on the first that does not stage, so a green job means every tarball the Build job packed is staged: nothing is live yet. `npm run release:staged` lists what is queued, with the actor and shasum behind each entry.
3. Run `npm run release:approve` (requires npm login with 2FA) to take the release live. It only approves staged ids matching the release version, and refuses when the number of staged ids differs from the number of workspaces.

All packages are published using OpenID Connect with a stage-only trusted publisher. Each new package must be configured first.

**Organization or user\*** middyjs
**Repository\*** middy
**Workflow filename\*** release.yml
**Publishing access** Require two-factor authentication and disallow tokens (recommended)

### 5. New packages

npm only lets you configure a trusted publisher on a package that already exists, so the first publish of a new package is manual, with 2FA. Do this before the release PR merges: the Publish job stages every workspace and fails on the first one that cannot be staged.

Not yet published as of 8.0.0-alpha.0:

- `@middy/ecs-batch`
- `@middy/ecs-http`
- `@middy/ecs-task`
- `@middy/event-logger`
- `@middy/response-logger`

For each package:

1. Publish a placeholder from an empty directory, not from the workspace: the workspace carries the version the release will stage, and staging a version that already exists fails the Publish job. npm sets `latest` on a package's first publish whatever `--tag` says, so the placeholder is `latest` until step 3; deprecate it straight away so an install in the meantime at least warns:

   ```bash
   cd "$(mktemp -d)"
   cat > package.json <<'EOF'
   { "name": "@middy/<name>", "version": "0.0.0", "license": "MIT", "description": "placeholder, see @middy/<name> 8.x" }
   EOF
   echo "Placeholder, see @middy/<name> 8.x" > README.md
   npm publish --access public --ignore-scripts
   npm deprecate @middy/<name>@0.0.0 "placeholder"
   ```

2. On npmjs.com, open the package settings and set **Publishing access** and the trusted publisher to the values listed above.
3. After the release is approved, point `latest` at the released version. Pre-releases are staged under `next`, and the five packages above have no stable version for `latest` to protect, so without this step `npm install @middy/<name>` resolves to the deprecated placeholder:

   ```bash
   npm dist-tag add @middy/<name>@8.0.0-alpha.0 latest
   ```

### 6. Removed packages

When a workspace is removed, deprecate its published versions so installs warn (requires 2FA). For v8:

```bash
npm deprecate @middy/input-output-logger "Replaced by @middy/event-logger and @middy/response-logger in v8"
npm deprecate @middy/do-not-wait-for-empty-event-loop "Removed in v8, callbacks are no longer supported in Lambda"
```

### 7. Rulesets

Required status checks are listed by name in [.github/rulesets/main.json](../.github/rulesets/main.json) and [develop.json](../.github/rulesets/develop.json). After changing a test matrix (for example the Node.js versions in `test-unit.yml`, which appear in check names such as `Tests (unit) (24.x)`), update the JSON and PUT it to the live rulesets:

```bash
gh api repos/middyjs/middy/rulesets | jq '.[] | {id,name}'
gh api -X PUT repos/middyjs/middy/rulesets/<id> --input .github/rulesets/main.json
gh api -X PUT repos/middyjs/middy/rulesets/<id> --input .github/rulesets/develop.json
```

## Maintenance releases

A shipped major line is patched from a long-lived `<major>.x` branch once `develop` has moved on to the next major. For 7.x:

1. Create the branch from the last tag of the line, once:

   ```bash
   git checkout -b 7.x 7.9.2
   git push origin 7.x
   ```

2. Protect it like `main`. [.github/rulesets/maintenance.json](../.github/rulesets/maintenance.json) is `main.json` with the branch condition set to `refs/heads/[0-9]*.x`, so one ruleset covers every maintenance branch (ruleset fnmatch has no `+`; the Actions branch filter in `release.yml` supports it and uses `[0-9]+.x`). It is not live yet; create it once, then update it with PUT like the others:

   ```bash
   gh api -X POST repos/middyjs/middy/rulesets --input .github/rulesets/maintenance.json
   gh api -X PUT repos/middyjs/middy/rulesets/<id> --input .github/rulesets/maintenance.json
   ```

3. Hotfix PRs target `7.x` instead of `main`. Bump the version as in step 2 (`npm run release:sync` included), on the hotfix branch or on a `release/7.9.3` branch off `7.x`. Merging triggers [release.yml](../.github/workflows/release.yml) exactly as on `main`; steps 3 and 4 apply unchanged, with `7.x` in place of `main` when tagging.
4. Port the fix forward to `develop` in a separate PR.

### Dist-tags

`release.yml` picks the npm dist-tag in the Build job from the version and the registry's current `@middy/core`:

| Version | Dist-tag |
| --- | --- |
| Pre-release (`X.Y.Z-alpha.N`) | `next` |
| Stable, at or above the registry's `latest` | `latest` |
| Stable, below the registry's `latest` (a `7.9.3` after `8.0.0`) | the major line, `7.x` |

So a maintenance release never moves `latest` backwards, and `npm install @middy/core@7.x` follows the line. There is no publish script to edit.

## Setting up new major release

- `package.json`: update `engines` versions
- Update the Node.js versions used by CI to the current AWS Lambda runtimes: the `node-version` matrix in `test-unit.yml` and `NODE_VERSION` in the other workflows under `.github/workflows/`, then apply the Rulesets step above because the unit check names include the version.
- Nothing to change for npm: `release.yml` picks the dist-tag from the version, see [Dist-tags](#dist-tags). Once the new major is on `latest`, patches for the previous line go through its maintenance branch, see [Maintenance releases](#maintenance-releases).

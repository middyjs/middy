# How to draft and publish a new release

For maintainers only.

This document explains what are the necessary steps to draft a new release and publish it on NPM and GitHub.

## Concepts

Middy is managed as a monorepo (currently using [Lerna](https://github.com/lerna/lerna)). This means that Middy core package and all the official middlewares are developed using the same repository.

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

### 1. Changelog

 - Releases should always be done from the `master` branch (unless working on a future/past major version branch like `0.x` or `2.0`).
 - You can create a `release-vX.Y.Z` branch if you want to do all the necessary changes in multiple commits and/or if you wish to have a review from the other maintainers
 - Update the [CHANGELOG](/CHANGELOG.md) creating a new entry for the new version and indicating with bullet points the major changes in the new version. There's no standard format agreed right now, but make sure to call out eventual breaking changes and, where possible, link to the various PRs contributing to the release and give credit to the authors of those changes.


### 2. Version bump

  - Update the `version` field of the main [`package.json`](/package.json) with the new version.
  - Run the command `npm run lerna:sync` to make sure every package will have the same version.
  - Commit all the changes so far.


### 3. Publish release on GitHub

  - If you have been working on a branch so far, make sure the branch is merged back to master (or its own version branch in case of future/past major versions).
  - Create a [new release on GitHub](https://github.com/middyjs/middy/releases/new), with the following attributes:
    - **Tag version**: `X.Y.Z` as per the target version. Note: don't use a `v` prefix for the version.
    - **Release title**: same as above
    - **Release description**: copy the changes from the [CHANGELOG.md](/CHANGELOG.md)
  - Publish release


### 4. Publish release on NPM

This step will happen automatically from GitHub actions after a new release has been drafted. Make sure to double check the action and see if it completed successfully.

## Setting up new major release

- `package.json`
  - Update `engines` versions
  - Add ` --dist-tag next` to `lerna:publish` script
- Update `build.yml` and `tests.yml` to use current AWS lambda nodejs runtimes

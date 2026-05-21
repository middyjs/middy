# Pipeline Architecture

This document describes middy's CI/CD pipeline: branch flow, what every workflow does, and how each piece maps to the controls in [docs/SPVS-COMPLIANCE.md](SPVS-COMPLIANCE.md). It addresses OWASP SPVS 1.5 V1.3.1.

## Branch flow

```
feature/*  -->  develop  -->  main  -->  npm
```

| Branch | Purpose | Merge gate |
| --- | --- | --- |
| `feature/*` | All work originates from a feature branch off `develop`. | PR review against `develop` (CI checks run, recommended but not ruleset-enforced) |
| `develop` | Integration branch. CI checks (lint, unit, types, SAST, perf, DAST, DCO) run on every PR. `release-please` opens version-bump PRs here. | Ruleset: deletion + non-fast-forward + signed commits required. PR review and required-status-checks are policy (CONTRIBUTING.md) but not currently enforced by the `develop` ruleset |
| `main` | Release branch. Merging a `develop -> main` PR triggers [release.yml](../.github/workflows/release.yml). | Ruleset enforces: deletion + non-fast-forward + signed commits + PR with 2 approvals + CODEOWNERS review + 18 required status checks + CodeQL/zizmor code-scanning gates. `release.yml` additionally waits on the `npm-publish` GitHub Environment for explicit human approval before `npm publish` |

DCO sign-off is required on every commit ([test-dco.yml](../.github/workflows/test-dco.yml)).

## Release pipeline (`release.yml`)

Triggered by closing (merging) a PR to `main` that changes `package.json`.

```
build  -->  release  -->  publish
```

| Job | Steps | SPVS controls |
| --- | --- | --- |
| `build` | harden-runner -> checkout -> setup-node -> npm ci -> `npm audit signatures` -> npm run build -> npm pack -> `actions/attest-build-provenance` (Sigstore) -> upload artifact | V2.6.1 dependency signature gating; V3.4.1 cryptographic signing of build artifacts |
| `release` | harden-runner -> setup-node -> download artifact -> `softprops/action-gh-release` (draft) | V4.1.1 release-candidate assessment |
| `publish` | harden-runner -> setup-node -> download artifact -> `gh attestation verify` -> `npm publish --provenance` (next or latest tag based on prerelease detection). Job is wrapped in `environment: npm-publish` with required reviewers. | V3.3.20 manual approval gate; V3.4.2 / V4.3.6 artifact integrity before deployment; V4.3.1 automated deployment |

`npm audit signatures` lives in `build` because it audits *build inputs* (your installed dependencies). `gh attestation verify` lives in `publish` because it audits the *artifact being pushed*.

## Continuous-integration workflows

These run on every PR and (where noted) on a weekly cron.

| Workflow | Trigger | Purpose | SPVS controls |
| --- | --- | --- | --- |
| [test-lint.yml](../.github/workflows/test-lint.yml) | PR | Biome lint + format check | V2.2.1 - V2.2.4 |
| [test-unit.yml](../.github/workflows/test-unit.yml) | PR | `node --test` with 100% lines/branches/functions coverage gate; Node 22 + Node 24 matrix | V2.2.5, V2.7.2 |
| [test-types.yml](../.github/workflows/test-types.yml) | PR | `tstyche` type tests | V2.7.1 |
| [test-perf.yml](../.github/workflows/test-perf.yml) | PR | `tinybench` performance regression check | Defence-in-depth |
| [test-dast.yml](../.github/workflows/test-dast.yml) | PR | Property-based fuzz tests via `fast-check` | V3.3.14 |
| [test-dco.yml](../.github/workflows/test-dco.yml) | PR | Developer Certificate of Origin sign-off | V1.3.5 |
| [test-sast.yml](../.github/workflows/test-sast.yml) | PR + weekly cron | Trivy SCA (vuln) + Trivy license + lockfile-lint + CodeQL + semgrep + actionlint + zizmor + TruffleHog + gitleaks | V2.4.1-6, V2.4.7-9, V2.4.14, V2.5.1, V2.6.1, V3.1.5, V3.3.1-9 |
| [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml) | weekly cron + push to `main` | OSSF Scorecard scan; SARIF upload to code-scanning + results published to scorecard.dev | V3.3.18, V3.3.19, V5.2.1 |
| [website-cloudflare-pages.yml](../.github/workflows/website-cloudflare-pages.yml) | push to `main` (under `websites/`) | Build + deploy the docs site | Outside SPVS scope (docs site, not the npm package) |

## Hardening conventions

These apply to every job in every workflow above.

- **Pinned actions.** All third-party actions are pinned by full commit SHA with a `# vX.Y.Z` comment. Dependabot tracks updates weekly.
- **Scoped permissions.** Every workflow declares `permissions: contents: read` at the top level. Jobs widen only where strictly needed (`id-token: write` for OIDC, `attestations: write` only in `build`, etc.).
- **Runner hardening.** Every job starts with `step-security/harden-runner` in `audit` egress mode with telemetry disabled, with one documented exception: the `semgrep` job in [test-sast.yml](../.github/workflows/test-sast.yml) runs inside the pinned `semgrep/semgrep` container where harden-runner cannot install. The audit log is reviewed quarterly per [docs/GOVERNANCE.md](GOVERNANCE.md) and `egress-policy` is moved to `block` once egress is stable.
- **No long-lived credentials.** npm publish uses OIDC. The only ambient credential is `GITHUB_TOKEN`, which auto-rotates per job. See [SECURITY.md](../SECURITY.md#secrets-policy).
- **Ephemeral runners.** All jobs run on GitHub-hosted `ubuntu-latest`. No self-hosted runners.
- **Workflow SAST.** zizmor and actionlint lint every workflow on every PR and weekly.

## Approval gates

| Gate | Where | Reviewers |
| --- | --- | --- |
| PR review on `develop` (policy) | Documented in [CONTRIBUTING.md](CONTRIBUTING.md); not currently ruleset-enforced | At least 1 of `@middyjs/owners` or `@middyjs/reviewers` |
| Required PR review on `main` | [.github/rulesets/main.json](../.github/rulesets/main.json) `pull_request` rule (2 approvals + CODEOWNERS) | `@middyjs/owners` |
| `npm-publish` environment | GitHub Environment in repo settings; `prevent_self_review: true` | `@middyjs/owners`, excluding the user who triggered the workflow run - must explicitly approve in the workflow run UI before `publish` job executes |

## Incident response

For pipeline-specific incidents, see [docs/INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md). For application-level vulnerabilities, see [SECURITY.md](../SECURITY.md#reporting-a-vulnerability).

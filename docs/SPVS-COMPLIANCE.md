# OWASP SPVS 1.5 Compliance

This document is middy's self-attestation against the [OWASP Secure Pipeline
Verification Standard (SPVS) 1.5](https://owasp.org/www-project-spvs/),
Levels 1 and 2. It catalogues each applicable control, the current state of
implementation, and the evidence (file path, workflow, policy section, or
maintainer attestation) supporting the claim.

| Field | Value |
| --- | --- |
| Target | `middyjs/middy` (monorepo) |
| Claimed level | SPVS 1.5 Level 2 (self-attested) |
| Scope | Pipeline + supply chain for all `@middy/*` packages |
| Out of scope | Library runtime application security (covered separately by [SECURITY.md](../SECURITY.md), aligned with OWASP ASVS v5.0 L3) |
| Assessment date | 2026-05-21 |
| Assessor | Project maintainers |
| Next review | 2027-05-21 (annual), or sooner on material pipeline change |

## How to read this document

Status legend:

- :white_check_mark: **Implemented** - control is in place and file-verifiable.
- :large_orange_diamond: **Partial** - mechanism present, with a known gap.
- :shield: **Attested** - control is enforced at the GitHub organisation or maintainer-workstation level and cannot be expressed in repository files; verified out of band by the maintainers.
- :no_entry_sign: **N/A** - control does not apply to this project (e.g. Infrastructure-as-Code controls when no IaC is shipped).

Evidence links point to files in this repository unless otherwise noted.

---

## V1 - Plan

### V1.1 Identity and Access Management

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V1.1.1 | 1 | MFA on developer laptops and critical systems | :shield: | Maintainer attestation; GitHub org enforces MFA for all maintainers |
| V1.1.2 | 2 | Centralised IdP for human and programmatic identities | :shield: | GitHub Identity is the canonical IdP for all maintainers and bots |
| V1.1.3 | 2 | Least-privilege access across pipeline tools | :white_check_mark: | Every workflow declares scoped `permissions:` per job: see [release.yml](../.github/workflows/release.yml), [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml), [test-sast.yml](../.github/workflows/test-sast.yml) |
| V1.1.4 | 2 | Stale identities removed after inactivity | :shield: | GitHub org-level review; inactive maintainers removed from `middyjs` org |
| V1.1.5 | 1 | Service-account tokens reviewed for over-permission | :white_check_mark: | No long-lived `NPM_TOKEN`; npm publish uses OIDC (`id-token: write`) in [release.yml](../.github/workflows/release.yml). Only auto-rotated `GITHUB_TOKEN` is used |
| V1.1.6 | 1 | VCS requires MFA | :shield: | `middyjs` GitHub organisation policy enforces MFA for all members; maintainer attestation. (Note: OSSF Scorecard does not include a per-user MFA check, so this is not file-verifiable from the repo.) |
| V1.1.7 | 1 | Quarterly audit of VCS administrators | :shield: | Maintainer attestation; org-admin list reviewed each quarter |
| V1.1.8 | 1 | Secrets encrypted at rest and in transit | :white_check_mark: | GitHub-managed; all secrets accessed only via HTTPS-only GitHub Actions runtime |

### V1.2 Hardening User Machines

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V1.2.1 | 1 | Endpoint protection running | :shield: | Maintainer attestation |
| V1.2.2 | 1 | Endpoint protection auto-updates | :shield: | Maintainer attestation |
| V1.2.3 | 1 | Full-disk encryption enabled | :shield: | Maintainer attestation |
| V1.2.4 | 1 | Patch management on developer laptops | :shield: | Maintainer attestation |
| V1.2.5 | 2 | Developer machines auto-lock after inactivity | :shield: | Maintainer attestation |
| V1.2.6 | 2 | CIS Benchmark controls applied to dev OS | :shield: | Maintainer attestation |

### V1.3 Security Requirements and Risk Assessment

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V1.3.1 | 1 | Documented software pipeline exists | :white_check_mark: | [docs/PIPELINE.md](PIPELINE.md) documents branch flow, every workflow, hardening conventions, and approval gates |
| V1.3.2 | 1 | Secure-development policy covers OWASP Top 10 CI/CD risks | :white_check_mark: | [SECURITY.md `OWASP CICD-SEC Top 10 Threat Mapping`](../SECURITY.md#owasp-cicd-sec-top-10-threat-mapping) maps every CICD-SEC risk to its primary mitigation |
| V1.3.3 | 2 | Secure OSS policy established | :white_check_mark: | [SECURITY.md `OSS Component Policy`](../SECURITY.md#oss-component-policy) covers source restriction, hash verification, signature verification, vulnerability scanning, license compliance, and action pinning |
| V1.3.4 | 1 | Secrets/credentials policy established | :white_check_mark: | [SECURITY.md `Secrets Policy`](../SECURITY.md#secrets-policy) covers OIDC-only publish, GitHub Secrets handling, secret-scanning enforcement, and MFA |
| V1.3.5 | 1 | Developers have reviewed the secure-dev policy | :shield: | Acknowledged by maintainers; DCO sign-off on every commit is enforced in [test-dco.yml](../.github/workflows/test-dco.yml) |

### V1.4 Developer Tool Operation

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V1.4.1 | 1 | Approved IDE / coding tools, up-to-date | :shield: | Maintainer attestation |
| V1.4.2 | 1 | IDE plugins meet policy and are approved | :shield: | Maintainer attestation |
| V1.4.3 | 1 | IDE plugins routinely updated | :shield: | Maintainer attestation |
| V1.4.4 | 2 | Developer tools use secure communication protocols | :shield: | Maintainer attestation |
| V1.4.5 | 2 | Developer tools monitored for unauthorised changes | :shield: | Maintainer attestation |

### V1.5 Source Code Management Hardening

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V1.5.1 | 1 | VCS implements RBAC | :white_check_mark: | GitHub teams (`@middyjs/owners`, `@middyjs/reviewers`) defined in [CODEOWNERS](../.github/CODEOWNERS) |
| V1.5.2 | 1 | `.gitignore` present | :white_check_mark: | [.gitignore](../.gitignore) at repo root |
| V1.5.3 | 2 | Branch schema enforces vulnerability remediation | :white_check_mark: | `feature -> develop -> main` flow documented in [CONTRIBUTING.md](CONTRIBUTING.md); release-please opens release PRs against `main` only |

---

## V2 - Develop

### V2.1 Secure Coding Practices

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.1.1 | 1 | Secure-coding OSS policy enforced | :white_check_mark: | Biome `recommended` rules in [biome.json](../biome.json); CodeQL `+security-and-quality` in [test-sast.yml](../.github/workflows/test-sast.yml) |

### V2.2 Software Quality

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.2.1 | 1 | Linting scans run at least monthly | :white_check_mark: | [test-lint.yml](../.github/workflows/test-lint.yml) runs on every PR |
| V2.2.2 | 1 | Lint detections remediated | :white_check_mark: | Lint failures block PR merge |
| V2.2.3 | 1 | Style scans run at least monthly | :white_check_mark: | Biome formatter covers style; same workflow |
| V2.2.4 | 1 | Style detections remediated | :white_check_mark: | Style failures block PR merge |
| V2.2.5 | 2 | Unit tests cover security-related code paths | :white_check_mark: | 100% coverage gate enforced by [test-unit.yml](../.github/workflows/test-unit.yml); fuzz suites in [test-dast.yml](../.github/workflows/test-dast.yml) exercise security-relevant input handlers |
| V2.2.6 | 1 | Code-quality tools flag insecure patterns | :white_check_mark: | Biome `recommended` + CodeQL `security-and-quality` |

### V2.3 Code Review and Analysis

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.3.1 | 2 | Code-review policy requires security review for every commit | :white_check_mark: | 2-reviewer rule documented in [CONTRIBUTING.md](CONTRIBUTING.md); reviewers drawn from `@middyjs/owners` / `@middyjs/reviewers` per [CODEOWNERS](../.github/CODEOWNERS) |
| V2.3.2 | 2 | Code reviews conducted per policy | :white_check_mark: | The `main` ruleset (see [.github/rulesets/main.json](../.github/rulesets/main.json)) requires 2 approving reviews + CODEOWNERS review on every PR; merging from `develop -> main` is therefore the enforced review gate. (`develop` itself is an integration branch with signed-commits enforcement only.) |

### V2.4 Perform Security Checks

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.4.1 | 2 | First-party SAST runs at least monthly | :white_check_mark: | CodeQL in [test-sast.yml](../.github/workflows/test-sast.yml) on every PR + weekly cron |
| V2.4.2 | 2 | First-party SAST on latest version | :white_check_mark: | `github/codeql-action@v4.35.4` pinned by SHA; Dependabot tracks updates |
| V2.4.3 | 2 | First-party SAST updated monthly | :white_check_mark: | Dependabot weekly schedule per [dependabot.yml](../.github/dependabot.yml) |
| V2.4.4 | 2 | Third-party SAST runs at least monthly | :white_check_mark: | semgrep + Trivy in [test-sast.yml](../.github/workflows/test-sast.yml) |
| V2.4.5 | 2 | Third-party SAST on latest version | :white_check_mark: | semgrep `1.111.0` image pinned; Trivy `v0.36.0` action pinned by SHA |
| V2.4.6 | 2 | Third-party SAST updated at least monthly | :white_check_mark: | Dependabot |
| V2.4.7 | 2 | Secrets-detection tool runs at least monthly | :white_check_mark: | TruffleHog + gitleaks in [test-sast.yml](../.github/workflows/test-sast.yml) on every PR + weekly cron |
| V2.4.8 | 2 | Secrets-detection tool on latest version | :white_check_mark: | TruffleHog `v3.95.2`, gitleaks `v2.3.9` pinned by SHA |
| V2.4.9 | 2 | Secrets-detection tool consistently updated | :white_check_mark: | Dependabot |
| V2.4.10 | 2 | IaC scanner runs at least monthly | :no_entry_sign: | No production IaC shipped from this repo |
| V2.4.11 | 2 | IaC scanner on latest version | :no_entry_sign: | N/A |
| V2.4.12 | 2 | IaC scanner updated at least monthly | :no_entry_sign: | N/A |
| V2.4.13 | 2 | IaC tools enforce security policies | :no_entry_sign: | N/A |
| V2.4.14 | 2 | Third-party libraries scanned for known vulns | :white_check_mark: | Trivy SCA in [test-sast.yml](../.github/workflows/test-sast.yml); Dependabot vulnerability alerts |
| V2.4.15 | 2 | Third-party libraries updated promptly | :white_check_mark: | Dependabot weekly with `develop` target branch per [dependabot.yml](../.github/dependabot.yml) |

### V2.5 Credential Hygiene

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.5.1 | 2 | No hardcoded credentials in code or pipeline config | :white_check_mark: | Enforced by TruffleHog (`--only-verified --results=verified,unknown`) and gitleaks in [test-sast.yml](../.github/workflows/test-sast.yml) |

### V2.6 Third-Party Library Audit

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.6.1 | 2 | Dependencies fetched from trusted sources and hash-verified | :white_check_mark: | `package-lock.json` commits integrity hashes (npm v3 lockfile); `lockfile-lint --allowed-hosts npm --validate-https` in [test-sast.yml](../.github/workflows/test-sast.yml); `npm audit signatures` runs in the `build` job of [release.yml](../.github/workflows/release.yml) immediately after `npm ci`, gating the build environment before any release artifact is produced |
| V2.6.2 | 2 | Dependency versions pinned to avoid dependency-confusion | :white_check_mark: | Lockfile committed at repo root; `npm ci` (not `npm install`) used in every workflow |

### V2.7 Unit Testing

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.7.1 | 2 | Security unit tests in development process | :white_check_mark: | Property-based fuzz tests via `fast-check` in [test-dast.yml](../.github/workflows/test-dast.yml); type tests via `tstyche` in [test-types.yml](../.github/workflows/test-types.yml) |
| V2.7.2 | 1 | Unit tests automated, run on every change | :white_check_mark: | [test-unit.yml](../.github/workflows/test-unit.yml) on every PR, Node 22 + 24 matrix |

---

## V3 - Integrate (CI)

### V3.1 Security of Pipeline Environment

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V3.1.1 | 1 | Build servers hardened and regularly patched | :white_check_mark: | Ephemeral GitHub-hosted `ubuntu-latest` runners (auto-patched); every job pins `step-security/harden-runner` (audit egress, telemetry disabled) with one documented exception: the `semgrep` job in [test-sast.yml](../.github/workflows/test-sast.yml) runs inside the pinned `semgrep/semgrep:1.111.0` container where harden-runner cannot install. See [release.yml](../.github/workflows/release.yml) and all `test-*` workflows |
| V3.1.2 | 2 | Access to build servers restricted | :white_check_mark: | GitHub-managed; no self-hosted runners |
| V3.1.3 | 2 | Build servers monitored for unauthorised access | :white_check_mark: | `harden-runner` egress audit logs accessible via the StepSecurity dashboard; org audit log available to admins |
| V3.1.5 | 2 | Build systems reviewed for misconfiguration | :white_check_mark: | zizmor + actionlint + CodeQL `actions` dataflow analysis in [test-sast.yml](../.github/workflows/test-sast.yml) (every PR + weekly) |

### V3.2 Credential Hygiene

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V3.2.1 | 1 | No hardcoded secrets in pipeline execution | :white_check_mark: | Pipeline uses GitHub Secrets and OIDC only; verified by TruffleHog + gitleaks in [test-sast.yml](../.github/workflows/test-sast.yml) |
| V3.2.2 | 1 | Pipeline uses built-in credential management | :white_check_mark: | GitHub Secrets store + OIDC token issuance for npm publish |
| V3.2.3 | 1 | Only authorised users can view pipeline secrets | :white_check_mark: | GitHub org/repo secrets RBAC |
| V3.2.4 | 1 | Secrets hidden in pipeline logs | :white_check_mark: | GitHub Actions auto-redacts registered secrets |
| V3.2.5 | 2 | Secrets used only for integration, not production stages | :white_check_mark: | npm publish uses short-lived OIDC token, not a stored credential |
| V3.2.6 | 2 | Secret rotation per policy | :white_check_mark: | OIDC tokens are per-workflow-run and expire automatically; `GITHUB_TOKEN` auto-rotates per job |

### V3.3 Continuous Security Checks

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V3.3.1 | 1 | First-party SAST runs at least monthly in CI | :white_check_mark: | CodeQL in [test-sast.yml](../.github/workflows/test-sast.yml) |
| V3.3.2 | 1 | First-party SAST on latest version | :white_check_mark: | Pinned by SHA, Dependabot-tracked |
| V3.3.3 | 1 | First-party SAST updated monthly | :white_check_mark: | Dependabot weekly |
| V3.3.4 | 1 | Third-party SAST/SCA runs monthly | :white_check_mark: | semgrep + Trivy in [test-sast.yml](../.github/workflows/test-sast.yml) |
| V3.3.5 | 1 | Third-party SAST/SCA on latest version | :white_check_mark: | Pinned by SHA, Dependabot-tracked |
| V3.3.6 | 1 | Third-party SAST/SCA updated monthly | :white_check_mark: | Dependabot weekly |
| V3.3.7 | 1 | Secrets-detection runs at least monthly | :white_check_mark: | TruffleHog + gitleaks in [test-sast.yml](../.github/workflows/test-sast.yml) |
| V3.3.8 | 1 | Secrets-detection on latest version | :white_check_mark: | Pinned by SHA |
| V3.3.9 | 1 | Secrets-detection consistently updated | :white_check_mark: | Dependabot |
| V3.3.10 | 1 | IaC scanner in CI | :no_entry_sign: | No IaC |
| V3.3.11 | 1 | IaC scanner latest | :no_entry_sign: | N/A |
| V3.3.12 | 1 | IaC scanner updated monthly | :no_entry_sign: | N/A |
| V3.3.13 | 1 | IaC policies enforced | :no_entry_sign: | N/A |
| V3.3.14 | 1 | DAST scans running app | :white_check_mark: | Property-based fuzz tests via `fast-check` exercise middleware request/response paths under random input in [test-dast.yml](../.github/workflows/test-dast.yml) |
| V3.3.15 | 2 | Automated security scans on new code integration | :white_check_mark: | Every PR triggers lint, unit, types, SAST, perf, DAST |
| V3.3.16 | 2 | Integration tests include security test cases | :white_check_mark: | Fuzz suites validate behaviour under malformed events |
| V3.3.17 | 2 | Security testing integrated into CI | :white_check_mark: | `test-sast.yml` is a required PR check |
| V3.3.18 | 2 | Branch protection rules enforced | :white_check_mark: | Rulesets-as-code in [.github/rulesets/](../.github/rulesets/) (one JSON per branch/tag scope, applied via `gh api`); the default branch (`main`) enforces deletion + non-fast-forward + signed commits + 2-approval PR + CODEOWNERS + 18 required status checks + CodeQL/zizmor code-scanning gates. OSSF Scorecard `Branch-Protection` check (scoped to the default branch) passes with a perfect score, continuously verified weekly by [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml). `develop` and tag rulesets are less strict and serve as integration / tag-protection scopes |
| V3.3.19 | 2 | Auto-merge rules restricted and reviewed | :white_check_mark: | Auto-merge can only execute after required reviews land, which is itself verified by the OSSF Scorecard `Branch-Protection` check (perfect score) via [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml) |
| V3.3.20 | 2 | Manual approval for sensitive operations | :white_check_mark: | `publish` job in [release.yml](../.github/workflows/release.yml) is wrapped in `environment: npm-publish`, a GitHub Environment with required reviewers from [@middyjs/owners](https://github.com/orgs/middyjs/teams/owners) and `prevent_self_review: true` so the user who triggered the workflow run cannot approve their own deployment; npm publish does not execute until an owner approves the run |

### V3.4 Integrity of Artifacts

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V3.4.1 | 2 | Build artifacts cryptographically signed | :white_check_mark: | `actions/attest-build-provenance` (Sigstore) generates SLSA L3 provenance on every release; see `build` job in [release.yml](../.github/workflows/release.yml). npm publish uses `--provenance` |
| V3.4.2 | 2 | Checksums validate artifact integrity before deployment | :white_check_mark: | `gh attestation verify` runs against each `*.tgz` immediately before `npm publish` in the `publish` job of [release.yml](../.github/workflows/release.yml) |

---

## V4 - Release (CD)

### V4.1 Final Security Assessments

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V4.1.1 | 1 | Comprehensive security assessment on release candidate | :white_check_mark: | The full `develop -> main` PR runs lint, unit (matrix), types, SAST (CodeQL, semgrep, Trivy, TruffleHog, gitleaks, actionlint, zizmor, lockfile-lint), perf, and DAST as gating checks |

### V4.2 Compliance Checks

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V4.2.1 | 1 | Pipeline policies formally documented, maintained, periodically reviewed | :white_check_mark: | This file ([docs/SPVS-COMPLIANCE.md](SPVS-COMPLIANCE.md)); see [Review cadence](#review-cadence) |

### V4.3 Secure Deployment Practices

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V4.3.1 | 1 | Automated deployment scripts minimise human error | :white_check_mark: | Fully automated via [release.yml](../.github/workflows/release.yml) (build, attest, GitHub release, npm publish) |
| V4.3.2 | 2 | Deployment scripts reviewed for security | :white_check_mark: | Workflows linted by actionlint + zizmor on every PR; CodeQL analyses workflow scripts |
| V4.3.3 | 2 | Secure transfer protocols during deployment | :white_check_mark: | HTTPS only (`registry.npmjs.org`); OIDC for npm publish |
| V4.3.4 | 2 | Configuration secured via secrets manager or encrypted config | :white_check_mark: | GitHub Secrets + OIDC; no plaintext config |
| V4.3.5 | 2 | Production environments isolated from dev/test | :no_entry_sign: | npm registry is the only "production"; no hosted environments |
| V4.3.6 | 2 | Deployment scripts check for unauthorised changes before execution | :white_check_mark: | `gh attestation verify` validates artifact provenance against the build attestation immediately before publish ([release.yml](../.github/workflows/release.yml)) |

---

## V5 - Operate

### V5.1 Access Audit

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V5.1.1 | 2 | Regular audits of users | :shield: | GitHub org admin review; maintainer attestation |
| V5.1.2 | 2 | Access logs maintained and reviewed | :shield: | GitHub audit log; org-admin attestation |
| V5.1.3 | 2 | Privileged access management implemented and monitored | :shield: | GitHub teams + branch protection; maintainer attestation |

### V5.2 Security Standard Enforcement

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V5.2.1 | 2 | Security policies continuously enforced in production | :white_check_mark: | OSSF Scorecard weekly via [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml); SAST/DAST suites run on every PR |
| V5.2.2 | 2 | Operational practices regularly reviewed | :white_check_mark: | [docs/GOVERNANCE.md `Review cadence`](GOVERNANCE.md#review-cadence) documents weekly, per-release, quarterly, semi-annual, and annual review activities with owners |

### V5.3 Secure Maintenance Practices

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V5.3.1 | 1 | Patches and updates applied in timely manner | :white_check_mark: | Dependabot weekly PRs for npm + GitHub Actions per [dependabot.yml](../.github/dependabot.yml) |

### V5.4 Detection and Monitoring

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V5.4.1 | 2 | Real-time monitoring generates pipeline security logs and detects anomalies | :shield: | GitHub Actions run logs + `harden-runner` egress audit + OSSF Scorecard; maintainer attestation that alerts are routed appropriately |
| V5.4.2 | 2 | Pipeline security logs routinely reviewed | :shield: | Maintainer attestation |
| V5.4.3 | 2 | Pipeline security alerts responded to in timely manner | :shield: | Maintainer attestation; vulnerability disclosure SLA defined in [SECURITY.md](../SECURITY.md) |

### V5.5 Incident Response and Recovery

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V5.5.1 | 2 | Incident-response plans include pipeline procedures | :white_check_mark: | [docs/INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) covers triage, containment paths (maintainer compromise, npm publish compromise, dependency compromise, workflow compromise), investigation, recovery, and post-incident review |
| V5.5.2 | 2 | Incident-response plans tested regularly | :white_check_mark: | Annual tabletop exercise scheduled in [docs/GOVERNANCE.md `Review cadence`](GOVERNANCE.md#review-cadence); exercise log table maintained in [docs/INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) |
| V5.5.3 | 2 | Recovery procedures tested and effective | :white_check_mark: | [docs/INCIDENT-RESPONSE.md `Phase 4 - Recover`](INCIDENT-RESPONSE.md#phase-4---recover) documents secret rotation, patched-version republish, consumer verification, and communication steps |

---

## AI Pipeline Addendum (SPVS 1.5-AI)

Not applicable. middy ships no AI/ML pipeline; no model artefacts, no training pipelines, and no LLM-generated production code paths exist in this repository.

---

## Review cadence

| Cadence | Activity | Owner |
| --- | --- | --- |
| Weekly | OSSF Scorecard scan; Dependabot updates; review SAST/secret-scan findings | Maintainers |
| Per release | All gating checks (lint, unit, types, SAST, perf, DAST) pass; provenance attestation + signature verification before publish | CI |
| Quarterly | Audit GitHub org admins (V1.1.7); review `harden-runner` egress audit logs and tighten policy where stable | Maintainers |
| Annually | Re-attest this document against the latest SPVS revision; review known-gaps list and close where feasible | Maintainers |

---

## Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-05-21 | 1.0 | Initial SPVS 1.5 Level 2 self-attestation. |

# OWASP SPVS 1.6 Compliance

This document is middy's self-attestation against the [OWASP Secure Pipeline
Verification Standard (SPVS) 1.6](https://owasp.org/www-project-spvs/).

| Field | Value |
| --- | --- |
| Target | `middyjs/middy` (monorepo) |
| Claimed level | SPVS Level 3 |
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
- :warning: **Risk accepted** - control applies but is deliberately not implemented; the decision and compensating controls are recorded in the Evidence column and re-reviewed at each annual re-attestation.

Level values in the core section are taken verbatim from the published SPVS 1.0 requirements CSV in [OWASP/www-project-spvs](https://github.com/OWASP/www-project-spvs) (`1.6/OWASP_SPVS_1.0_-en_Requirements.csv`). Controls with no level assigned in the CSV are shown as `-`. 

Level 3: against these level assignments, every Level 3 control is Implemented, Attested, or N/A.

Evidence links point to files in this repository unless otherwise noted.

---

## V1 - Plan

### V1.1 Identity and Access Management

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V1.1.1 | 2 | MFA on developer laptops and critical systems | :shield: | Maintainer attestation; GitHub org enforces MFA for all maintainers |
| V1.1.2 | 3 | Centralised IdP for human and programmatic identities | :shield: | GitHub Identity is the canonical IdP for all maintainers and bots |
| V1.1.3 | 3 | Least-privilege access across pipeline tools | :white_check_mark: | Every workflow declares scoped `permissions:` per job: see [release.yml](../.github/workflows/release.yml), [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml), [test-sast.yml](../.github/workflows/test-sast.yml) |
| V1.1.4 | 3 | Stale identities removed after inactivity | :shield: | GitHub org-level review; inactive maintainers removed from `middyjs` org |
| V1.1.5 | 2 | Service-account tokens reviewed for over-permission | :white_check_mark: | No long-lived `NPM_TOKEN`; npm publish uses OIDC (`id-token: write`) in [release.yml](../.github/workflows/release.yml). Only auto-rotated `GITHUB_TOKEN` is used |
| V1.1.6 | 2 | VCS requires MFA | :shield: | `middyjs` GitHub organisation policy enforces MFA for all members; maintainer attestation. (Note: OSSF Scorecard does not include a per-user MFA check, so this is not file-verifiable from the repo.) |
| V1.1.7 | 2 | Quarterly audit of VCS administrators | :shield: | Maintainer attestation; org-admin list reviewed each quarter |
| V1.1.8 | 1 | Secrets encrypted at rest and in transit | :white_check_mark: | GitHub-managed; all secrets accessed only via HTTPS-only GitHub Actions runtime |

### V1.2 Hardening User Machines

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V1.2.1 | 1 | Endpoint protection running | :shield: | Maintainer attestation |
| V1.2.2 | 1 | Endpoint protection auto-updates | :shield: | Maintainer attestation |
| V1.2.3 | 1 | Full-disk encryption enabled | :shield: | Maintainer attestation |
| V1.2.4 | 1 | Patch management on developer laptops | :shield: | Maintainer attestation |
| V1.2.5 | 3 | Developer machines auto-lock after inactivity | :shield: | Maintainer attestation |
| V1.2.6 | 3 | CIS Benchmark controls applied to dev OS | :shield: | Maintainer attestation |

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
| V1.5.3 | 3 | Branch schema enforces vulnerability remediation | :white_check_mark: | `feature -> develop -> main` flow documented in [CONTRIBUTING.md](CONTRIBUTING.md); release PRs against `main` are opened by a maintainer per [RELEASE.md](RELEASE.md) |

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
| V2.3.1 | 3 | Code-review policy requires security review for every commit | :white_check_mark: | 2-reviewer rule documented in [CONTRIBUTING.md](CONTRIBUTING.md); reviewers drawn from `@middyjs/owners` / `@middyjs/reviewers` per [CODEOWNERS](../.github/CODEOWNERS) |
| V2.3.2 | 3 | Code reviews conducted per policy | :white_check_mark: | The `main` ruleset (see [.github/rulesets/main.json](../.github/rulesets/main.json)) requires 2 approving reviews + CODEOWNERS review on every PR; merging from `develop -> main` is therefore the enforced review gate. (`develop` itself is an integration branch with signed-commits enforcement only.) |

### V2.4 Perform Security Checks

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.4.1 | 2 | First-party SAST runs at least monthly | :white_check_mark: | CodeQL in [test-sast.yml](../.github/workflows/test-sast.yml) on every PR + weekly cron |
| V2.4.2 | 2 | First-party SAST on latest version | :white_check_mark: | `github/codeql-action` pinned by SHA; Dependabot tracks updates weekly |
| V2.4.3 | 2 | First-party SAST updated monthly | :white_check_mark: | Dependabot weekly schedule per [dependabot.yml](../.github/dependabot.yml) |
| V2.4.4 | 2 | Third-party SAST runs at least monthly | :white_check_mark: | semgrep + Trivy in [test-sast.yml](../.github/workflows/test-sast.yml) |
| V2.4.5 | 2 | Third-party SAST on latest version | :white_check_mark: | semgrep container image pinned by digest; Trivy action pinned by SHA; Dependabot tracks updates weekly |
| V2.4.6 | 2 | Third-party SAST updated at least monthly | :white_check_mark: | Dependabot |
| V2.4.7 | 2 | Secrets-detection tool runs at least monthly | :white_check_mark: | TruffleHog + gitleaks in [test-sast.yml](../.github/workflows/test-sast.yml) on every PR + weekly cron |
| V2.4.8 | 2 | Secrets-detection tool on latest version | :white_check_mark: | TruffleHog and gitleaks actions pinned by SHA; Dependabot tracks updates weekly |
| V2.4.9 | 2 | Secrets-detection tool consistently updated | :white_check_mark: | Dependabot |
| V2.4.10 | 2 | IaC scanner runs at least monthly | :no_entry_sign: | No production IaC shipped from this repo |
| V2.4.11 | 2 | IaC scanner on latest version | :no_entry_sign: | N/A |
| V2.4.12 | 2 | IaC scanner updated at least monthly | :no_entry_sign: | N/A |
| V2.4.13 | 2 | IaC tools enforce security policies | :no_entry_sign: | N/A |
| V2.4.14 | 2 | Third-party libraries scanned for known vulns | :white_check_mark: | Trivy SCA in [test-sast.yml](../.github/workflows/test-sast.yml); Dependabot vulnerability alerts |
| V2.4.15 | 2 | Third-party libraries updated promptly | :white_check_mark: | Dependabot weekly with `develop` target branch per [dependabot.yml](../.github/dependabot.yml) |
| V2.4.16 | - | Pre-commit security scans detect issues before commit | :white_check_mark: | husky pre-commit hook runs lint + unit tests (`git:pre-commit` in [package.json](../package.json)); commitlint + DCO sign-off enforced at commit time |

### V2.5 Credential Hygiene

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.5.1 | 2 | No hardcoded credentials in code or pipeline config | :white_check_mark: | Enforced by TruffleHog (`--only-verified --results=verified,unknown`) and gitleaks in [test-sast.yml](../.github/workflows/test-sast.yml) |

### V2.6 Third-Party Library Audit

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.6.1 | 3 | Dependencies fetched from trusted sources and hash-verified | :white_check_mark: | `package-lock.json` commits integrity hashes (npm v3 lockfile); `lockfile-lint --allowed-hosts npm --validate-https` in [test-sast.yml](../.github/workflows/test-sast.yml); `npm audit signatures` runs in the `build` job of [release.yml](../.github/workflows/release.yml) immediately after `npm ci`, gating the build environment before any release artifact is produced |
| V2.6.2 | 3 | Dependency versions pinned to avoid dependency-confusion | :white_check_mark: | Lockfile committed at repo root; `npm ci` (not `npm install`) used in every workflow |

### V2.7 Unit Testing

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.7.1 | 2 | Security unit tests in development process | :white_check_mark: | Property-based fuzz tests via `fast-check` in [test-dast.yml](../.github/workflows/test-dast.yml); type tests via `tstyche` in [test-types.yml](../.github/workflows/test-types.yml) |
| V2.7.2 | 2 | Unit tests automated, run on every change | :white_check_mark: | [test-unit.yml](../.github/workflows/test-unit.yml) on every PR, Node 22 + 24 matrix |

---

## V3 - Integrate (CI)

### V3.1 Security of Pipeline Environment

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V3.1.1 | 1 | Build servers hardened and regularly patched | :white_check_mark: | Ephemeral GitHub-hosted `ubuntu-latest` runners (auto-patched); every job pins `step-security/harden-runner` (audit egress, telemetry disabled) with one documented exception: the `semgrep` job in [test-sast.yml](../.github/workflows/test-sast.yml) runs inside the digest-pinned `semgrep/semgrep` container where harden-runner cannot install. See [release.yml](../.github/workflows/release.yml) and all `test-*` workflows |
| V3.1.2 | 2 | Access to build servers restricted | :white_check_mark: | GitHub-managed; no self-hosted runners |
| V3.1.3 | 2 | Build servers monitored for unauthorised access | :white_check_mark: | `harden-runner` egress audit logs accessible via the StepSecurity dashboard; org audit log available to admins |
| V3.1.4 | - | Build systems hardened per platform/industry guidelines | :white_check_mark: | `step-security/harden-runner` on every job; ephemeral GitHub-hosted runners; zizmor GitHub Actions hardening enforced as a required check |
| V3.1.5 | 3 | Build systems reviewed for misconfiguration | :white_check_mark: | zizmor + actionlint + CodeQL `actions` dataflow analysis in [test-sast.yml](../.github/workflows/test-sast.yml) (every PR + weekly) |

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
| V3.3.18 | 3 | Branch protection rules enforced | :white_check_mark: | Rulesets-as-code in [.github/rulesets/](../.github/rulesets/) (one JSON per branch/tag scope, applied via `gh api`); the default branch (`main`) enforces deletion + non-fast-forward + signed commits + 2-approval PR + CODEOWNERS + all required status checks defined in the ruleset + CodeQL/zizmor code-scanning gates. OSSF Scorecard `Branch-Protection` check (scoped to the default branch) passes with a perfect score, continuously verified weekly by [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml). `develop` and tag rulesets are less strict and serve as integration / tag-protection scopes |
| V3.3.19 | 3 | Auto-merge rules restricted and reviewed | :white_check_mark: | Auto-merge can only execute after required reviews land, which is itself verified by the OSSF Scorecard `Branch-Protection` check (perfect score) via [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml) |
| V3.3.20 | 3 | Manual approval for sensitive operations | :white_check_mark: | `publish` job in [release.yml](../.github/workflows/release.yml) is wrapped in `environment: npm-publish`, a GitHub Environment with required reviewers from [@middyjs/owners](https://github.com/orgs/middyjs/teams/owners) and `prevent_self_review: true` so the user who triggered the workflow run cannot approve their own deployment; npm publish does not execute until an owner approves the run |

### V3.4 Integrity of Artifacts

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V3.4.1 | 3 | Build artifacts cryptographically signed | :white_check_mark: | `actions/attest-build-provenance` (Sigstore) generates SLSA L3 provenance on every release; see `build` job in [release.yml](../.github/workflows/release.yml). npm publish uses `--provenance` |
| V3.4.2 | 3 | Checksums validate artifact integrity before deployment | :white_check_mark: | `gh attestation verify` runs against each `*.tgz` immediately before `npm publish` in the `publish` job of [release.yml](../.github/workflows/release.yml) |

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
| V5.2.1 | 3 | Security policies continuously enforced in production | :white_check_mark: | OSSF Scorecard weekly via [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml); SAST/DAST suites run on every PR |
| V5.2.2 | 3 | Operational practices regularly reviewed | :white_check_mark: | [docs/GOVERNANCE.md `Review cadence`](GOVERNANCE.md#review-cadence) documents weekly, per-release, quarterly, semi-annual, and annual review activities with owners |

### V5.3 Secure Maintenance Practices

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V5.3.1 | 1 | Patches and updates applied in timely manner | :white_check_mark: | Dependabot weekly PRs for npm + GitHub Actions per [dependabot.yml](../.github/dependabot.yml) |

### V5.4 Detection and Monitoring

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V5.4.1 | 2 | Real-time monitoring generates pipeline security logs and detects anomalies | :shield: | GitHub Actions run logs + `harden-runner` egress audit + OSSF Scorecard + npm publish notification emails; maintainer attestation that alerts are routed appropriately |
| V5.4.2 | 2 | Pipeline security logs routinely reviewed | :shield: | Maintainer attestation |
| V5.4.3 | 2 | Pipeline security alerts responded to in timely manner | :shield: | Maintainer attestation; vulnerability disclosure SLA defined in [SECURITY.md](../SECURITY.md) |

### V5.5 Incident Response and Recovery

| ID | Level | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V5.5.1 | 2 | Incident-response plans include pipeline procedures | :white_check_mark: | [docs/INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) covers triage, containment paths (maintainer compromise, npm publish compromise, dependency compromise, workflow compromise), investigation, recovery, and post-incident review |
| V5.5.2 | 3 | Incident-response plans tested regularly | :white_check_mark: | Annual tabletop per [docs/GOVERNANCE.md `Review cadence`](GOVERNANCE.md#review-cadence); first exercise (Path B, 2026-08-21) logged in [docs/INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) with 7 runbook improvements folded back the same day |
| V5.5.3 | 3 | Recovery procedures tested and effective | :white_check_mark: | [docs/INCIDENT-RESPONSE.md `Phase 4 - Recover`](INCIDENT-RESPONSE.md#phase-4---recover) documents secret rotation, patched-version republish, consumer verification, and communication steps |

---

## SPVS 1.6 - Supply Chain Attack Controls

The 1.6 control set (`1.6/OWASP_SPVS_1.6_-en_Requirements.csv`) is incident-derived: every control traces to a named 2025/2026 supply-chain attack (Shai-Hulud, TeamPCP, the Axios/OpenAI cascade, Miasma, IDE extension breaches, and others). Controls carry a severity, not a level. Assessed 2026-08-21.

### V1 - Plan

| ID | Severity | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V1.1.1 | Critical | Phishing-resistant MFA on package-publishing accounts | :shield: | WebAuthn MFA for all maintainer GitHub accounts per [GOVERNANCE.md](GOVERNANCE.md); npm account 2FA maintainer-attested; npm staged publishing enforced (stage-only trusted publisher, tokens disallowed), so every live publish requires a maintainer 2FA approval |
| V1.1.2 | High | No single credential writes to more than one repository/package/service | :warning: | Deliberate: one approved release run covers the whole lockstep monorepo scope. Since staged publishing was enforced, no credential can produce a live publish at all: the per-run repo-scoped OIDC token can only stage, and going live requires a maintainer 2FA approval per release. The control's worm-propagation risk is neutralized; the letter (per-package credentials) is incompatible with a monorepo |
| V1.1.3 | High | Repository read access scoped by team/project, not org-wide | :no_entry_sign: | Public repositories; read access is public by design |
| V1.1.4 | High | Workflow permissions default read-only; writes per workflow with documented justification | :white_check_mark: | Every workflow declares top-level `permissions: contents: read` (or `{}`); job-level writes carry inline justification comments (see [release.yml](../.github/workflows/release.yml)); org-level read-only default maintainer-attested |
| V1.2.1 | High | Build, sign, publish share no admin accounts, credentials, or credential store | :white_check_mark: | Separate jobs on ephemeral runners with per-job auto-rotated `GITHUB_TOKEN`; signing via per-run Sigstore OIDC in `build`; no shared credential store ([release.yml](../.github/workflows/release.yml)) |
| V1.3.1 | High | Developer tool installs/config/extension inventory monitored for unauthorized changes | :shield: | Maintainer attestation |
| V1.3.2 | High | Developer tool extension egress governed by destination allowlist with alerts | :shield: | Outbound application firewall in alert-on-new-destination mode with a documented destination policy per [WORKSTATION.md](WORKSTATION.md); maintainer attestation |
| V1.3.3 | High | IDE extensions centrally approved, version-pinned, checksum-verified; auto-update gated | :shield: | Extension review + auto-update-disabled policy per [WORKSTATION.md](WORKSTATION.md); maintainer attestation |
| V1.3.4 | High | Toolchain execution isolated from host credentials/config/network | :shield: | npm v12 install-scripts-off (`packageManager` pin in [package.json](../package.json)), keychain-only credentials, no registry tokens in `~/.npmrc` per [WORKSTATION.md](WORKSTATION.md); maintainer attestation |
| V1.3.5 | Critical | No automatic code execution on repo open before workspace trust | :shield: | Editor workspace-trust enabled; maintainer attestation |
| V1.4.1 | Medium | Pipeline enforces commit-signature verification against an approved signer list | :white_check_mark: | Rulesets require verified signed commits on `develop` and `main` ([.github/rulesets/](../.github/rulesets/)); signer set bounded by org membership + CODEOWNERS review |

### V2 - Develop

| ID | Severity | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V2.1.1 | High | No plaintext secrets in local environment files | :shield: | Maintainer attestation; anything committed is blocked by TruffleHog + gitleaks ([test-sast.yml](../.github/workflows/test-sast.yml)) |
| V2.2.1 | Critical | Install scripts off by default; enabled only for reviewed packages | :white_check_mark: | `npm ci --ignore-scripts` in every workflow; npm v12 (pinned via `packageManager`) disables install scripts by default locally |
| V2.2.2 | Critical | New packages screened for risk signals; minimum publish-age enforced | :white_check_mark: | 14-day cooldown enforced twice: Dependabot ([dependabot.yml](../.github/dependabot.yml)) and `min-release-age=14` in [.npmrc](../.npmrc) at local resolution time; `Dependency Review` required check fails PRs introducing known-malicious or vulnerable packages ([test-sast.yml](../.github/workflows/test-sast.yml)); risk-signal screening documented in [SECURITY.md OSS Component Policy](../SECURITY.md#oss-component-policy) |
| V2.2.3 | High | Lockfile integrity-checked against manifest before build; fail on mismatch | :white_check_mark: | `npm ci` fails on manifest/lockfile mismatch; `lockfile-lint` host/HTTPS gate; `npm audit signatures` in the release build |
| V2.2.4 | Medium | Dependency inventory (incl. transitive depth) reviewed on cadence with recorded justification | :white_check_mark: | [DEPENDENCIES.md](DEPENDENCIES.md) records the full runtime inventory with per-dependency justification; reviewed quarterly per [GOVERNANCE.md](GOVERNANCE.md) and updated in the same PR as any dependency change |
| V2.2.5 | High | Package names screened for typosquats/slopsquats before first resolution | :white_check_mark: | Exact-name verification before first install documented in [SECURITY.md](../SECURITY.md#oss-component-policy); `Dependency Review` required check flags known-malicious packages on every PR |
| V2.2.6 | High | Public registries consumed via private proxy; direct public installs blocked in CI | :warning: | Deliberate direct public-registry consumption (no proxy infrastructure for a public OSS project). Compensating: committed lockfile + `npm ci` everywhere (no floating resolution in CI) + `lockfile-lint --allowed-hosts npm` |

### V3 - Integrate (CI)

| ID | Severity | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V3.1.1 | High | Installs resolve exactly from the lockfile | :white_check_mark: | `npm ci` in every workflow; no floating installs |
| V3.1.2 | Critical | No untrusted external text interpolated into pipeline commands | :white_check_mark: | zizmor template-injection audit is a required check + code-scanning gate on `main` |
| V3.1.3 | High | Build and publish are separate stages with the artifact held for review between | :white_check_mark: | `build -> release -> publish` in [release.yml](../.github/workflows/release.yml); artifact held; `npm-publish` environment approval between |
| V3.1.4 | Critical | Pipeline-definition changes scanned pre-merge; unsafe triggers/injection/over-permission block merge | :white_check_mark: | zizmor + actionlint + CodeQL `actions` required on every PR; zizmor code-scanning gate in the `main` ruleset |
| V3.1.5 | High | Container base images pinned to digest | :white_check_mark: | The only container in use (`semgrep/semgrep`) is digest-pinned in [test-sast.yml](../.github/workflows/test-sast.yml) |
| V3.1.6 | High | Runners ephemeral or re-imaged on schedule | :white_check_mark: | GitHub-hosted ephemeral runners only |
| V3.1.7 | Critical | Install/build egress denied by default, allowlist only | :white_check_mark: | `egress-policy: block` with a per-job `allowed-endpoints` allowlist on every workflow job. Two documented exceptions: semgrep (pinned container, harden-runner cannot install) and TruffleHog (verification egress is data-dependent by design; audit mode). See [PIPELINE.md](PIPELINE.md) hardening conventions |
| V3.2.1 | High | Secrets to shared/reusable pipelines limited to the one job that needs them | :white_check_mark: | No reusable-workflow secret inheritance; secrets injected per step only where needed |
| V3.2.2 | High | No org-wide secrets; credentials restricted per project | :white_check_mark: | Repo-scoped secrets only (`GITLEAKS_LICENSE`, Cloudflare pair); no org-level secrets (maintainer attestation) |
| V3.2.3 | High | No static-token fallback beside OIDC publishing | :white_check_mark: | No `NPM_TOKEN` exists anywhere; OIDC is the only publish path |
| V3.3.1 | High | Security scanning tools integrity-checked before running | :white_check_mark: | All scanner actions SHA-pinned; scanner container digest-pinned |
| V3.3.2 | Critical | Install/build runtime instrumentation alerts on unlisted processes/destinations | :large_orange_diamond: | `harden-runner` enforces per-job network allowlists and alerts blocked events via the StepSecurity insights page; process-level allowlisting not configured. Known gap |
| V3.4.1 | High | Published artifacts automatically compared against pipeline output; divergence blocks/alerts | :white_check_mark: | `gh attestation verify` pre-publish + npm `--provenance` binding + `npm stage publish` ([release.yml](../.github/workflows/release.yml)); registry-side the trusted publisher is stage-only with token publish disallowed (set 2026-08-21), so no version goes live without maintainer 2FA approval via the version-filtered `release:approve` |
| V3.4.2 | Critical | Signed provenance attestation binds artifact to source, builder, build params | :white_check_mark: | `actions/attest-build-provenance` (SLSA) + `npm publish --provenance`; consumers verify via `npm audit signatures` |
| V3.4.3 | High | Each stage verifies the signature of artifacts from the previous stage | :white_check_mark: | `gh attestation verify` in `publish` before `npm publish` |
| V3.4.4 | Medium | Pinned commit refs resolve to commits reachable from a protected upstream branch | :white_check_mark: | zizmor-action runs its online audits, including `impostor-commit` (pinned SHAs must exist in the upstream repository, not only a fork), by default with the job token on every PR ([test-sast.yml](../.github/workflows/test-sast.yml)) |
| V3.4.5 | High | CI cache contents signed/checksummed and verified before use | :no_entry_sign: | Release pipeline is cache-free by explicit `package-manager-cache: false`; no cache feeds any published artifact |
| V3.4.6 | High | Attestations validated against a documented builder-identity + isolation policy | :white_check_mark: | `gh attestation verify --repo middyjs/middy` enforces source/builder binding; policy documented in [PIPELINE.md](PIPELINE.md) |
| V3.4.7 | Critical | Release tags immutable; overwrite attempts rejected and logged | :white_check_mark: | Tag ruleset blocks deletion + non-fast-forward ([.github/rulesets/version.json](../.github/rulesets/version.json)); GitHub audit log records attempts |
| V3.4.8 | Medium | Build actions resolve transitive dependencies to immutable identifiers | :warning: | JS actions vendor their bundled dependencies at the pinned SHA; scanner actions that fetch tool binaries at runtime do so by pinned version over per-job egress allowlists. Full vendoring deliberately not implemented |

### V4 - Release (CD)

| ID | Severity | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V4.1.1 | High | Verification bypass only via documented break-glass with alert + post-incident review | :white_check_mark: | No bypass path exists; the break-glass procedure is documented in [PIPELINE.md `Break-glass`](PIPELINE.md#break-glass): gated `[break-glass]` PR + linked incident + revert-first-PR-after + incident-log entry with Phase 5 review |
| V4.1.2 | High | Release stage refuses credentials carried from earlier stages | :white_check_mark: | Per-job auto-rotated `GITHUB_TOKEN`; `publish` mints its own OIDC token; only artifacts cross stage boundaries |
| V4.1.3 | Critical | Cross-package publish cooldown per identity without extra human approval | :no_entry_sign: | Lockstep monorepo publishes the scope in one human-approved run (`npm-publish` environment, `prevent_self_review`); per-package cooldown is incompatible by design and the approval gate is the compensating control |

### V5 - Operate

| ID | Severity | Requirement | Status | Evidence |
| --- | --- | --- | --- | --- |
| V5.1.1 | High | Production components trace to a pinned, validated SBOM | :no_entry_sign: | Library with no hosted production; consumer-side traceability via npm provenance |
| V5.2.1 | High | Runner egress monitored with alerts on unauthorized destinations | :white_check_mark: | `egress-policy: block` with per-job allowlists on every workflow (documented audit-mode exceptions: TruffleHog); blocked events surfaced per run via the StepSecurity insights page and reviewed quarterly per [GOVERNANCE.md](GOVERNANCE.md) |
| V5.2.2 | High | Cloud metadata/IMDS queries from build agents restricted and alerted | :no_entry_sign: | GitHub-hosted runners; no cloud credentials or metadata endpoints in use |
| V5.2.3 | Medium | Cross-process memory reads on build agents alerted | :warning: | No memory-read detection instrumentation; accepted: `disable-sudo: true` on every job blocks root-path memory access and privilege escalation, and ephemeral single-job runners with per-job auto-rotated tokens bound the exposure window. Same-UID reads remain undetected |
| V5.2.4 | High | Automated publishes always notify; unexpected publishes investigated | :white_check_mark: | npm publish notification emails to maintainers; every publish additionally halts in the stage queue for maintainer review (stage-only trusted publisher); investigation path is [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) path B |
| V5.2.5 | Medium | Workloads in shared runtime clusters verified against an approved list | :no_entry_sign: | No runtime cluster |
| V5.2.6 | High | Pipeline-definition changes alerted and logged with actor identity | :white_check_mark: | Workflow edits land only via gated PR (review notifications); GitHub audit log records the actor |
| V5.2.7 | High | Developer endpoints alert on anomalous tool/extension behaviour | :shield: | Endpoint protection per maintainer attestation (core V1.2 controls) |
| V5.3.1 | High | Incident credential rotation revokes the compromised credential before activating its replacement, within an SLO | :white_check_mark: | [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) Phase 4 step 1 + path B step 3; 4-hour containment SLO |

### Known gaps and risk acceptances (1.6)

Remaining :large_orange_diamond: Partial row:

1. **Process-level instrumentation** (V3.3.2) - network allowlists are enforced per job; process/interpreter allowlisting is not configured. Revisit against SPVS 2.0 (October).

Risk acceptances (:warning: rows): lockstep scope publishing (V1.1.2), direct public-registry consumption (V2.2.6), runtime tool fetches by scanner actions (V3.4.8), and memory-read detection (V5.2.3). Each records its compensating controls in its Evidence cell and is re-reviewed at the annual re-attestation.

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
| 2026-08-21 | 1.1 | Levels reconciled to the published SPVS 1.0 requirements CSV; added V2.4.16 and V3.1.4; evidence de-versioned (pinned-by-SHA + Dependabot cited instead of exact tool versions); release-please references corrected to the manual release flow ([RELEASE.md](RELEASE.md)). |
| 2026-08-21 | 1.2 | First tabletop exercise (Path B) conducted and logged; incident-response runbook updated with 7 improvements; claimed level raised to Level 3. |
| 2026-08-21 | 1.3 | Re-attested against SPVS 1.6: added the 50-control supply-chain section (23 implemented, 16 partial, 5 attested, 6 N/A); target retargeted from 1.5 to 1.6. |
| 2026-08-21 | 1.4 | 1.6 gap closure: deny-by-default egress with per-job allowlists across all workflows; `Dependency Review` required check; runtime dependency inventory ([DEPENDENCIES.md](DEPENDENCIES.md)); workstation policy ([WORKSTATION.md](WORKSTATION.md)); break-glass procedure ([PIPELINE.md](PIPELINE.md#break-glass)); 4 risk acceptances recorded. Partial count 16 -> 2. |
| 2026-08-21 | 1.5 | npm staged publishing enforced registry-side (stage-only trusted publisher, tokens disallowed); V3.4.1 closed; `release:approve` filters approvals to the release version. Partial count 2 -> 1. |
| 2026-08-21 | 1.6 | `disable-sudo: true` added to every harden-runner job; V1.1.2 and V5.2.3 acceptance evidence strengthened (staging containment; root-path memory access blocked). |

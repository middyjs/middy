# Security Policy

This document outlines security procedures and general policies for the Middy Open Source projects as found on https://github.com/middyjs.

* [Security Goals](#security-goals)
* [Secure design principles](#secure-design-principles)
* [Supported Versions](#supported-versions)
* [Threat model](#threat-model)
* [Trust Boundaries](#trust-boundaries)
* [OWASP CICD-SEC Top 10 Threat Mapping](#owasp-cicd-sec-top-10-threat-mapping)
* [Secrets Policy](#secrets-policy)
* [OSS Component Policy](#oss-component-policy)
* [Reporting a Vulnerability](#reporting-a-vulnerability)
* [Disclosure Policy](#disclosure-policy)
* [Pipeline Incident Response](#pipeline-incident-response)

## Security Goals
Our goal is to ensure Middy meets security best practices as outlined by the following standards.

- [AWS Foundational Security Best Practices v1.0.0 (FSBP)](https://docs.aws.amazon.com/securityhub/latest/userguide/fsbp-standard.html)
- [CIS AWS Foundations Benchmark v3.0.0](https://docs.aws.amazon.com/securityhub/latest/userguide/cis-aws-foundations-benchmark.html)
- [NIST SP 800-53 Rev. 5](https://docs.aws.amazon.com/securityhub/latest/userguide/nist-standard.html)
- [OWASP ASVS v5.0 Level 3](https://github.com/OWASP/ASVS/tree/master/5.0/en)

Core maintainers use Middy extensively within their own organizations that meet the above standards tested using SecurityHub and penetration testing.

## Secure design principles

- secure by default
- use white lists
- no backdoors
- follow least privilege
- keep it simple

## Supported Versions
Only the latest version is supported for security updates.

## Threat model

All options and configuration are assume to be trusted as we are configured by the implementing developer. It's up the implement IAM properly.

## Trust Boundaries

Middy is implemented within AWS Lambda. The Lambda execution and configuration of middy is trusted. It's up to the implementing developer to apply input validation to ensure the event is properly structured and safe to use for the handler. User inputs to all packages are fuzzed.

## OWASP CICD-SEC Top 10 Threat Mapping

Middy's CI/CD pipeline is designed against the [OWASP Top 10 CI/CD Security Risks](https://owasp.org/www-project-top-10-ci-cd-security-risks/). The table below maps each risk to its primary mitigation in this repository.

| OWASP CICD-SEC | Risk | Primary mitigation |
| --- | --- | --- |
| CICD-SEC-1 | Insufficient Flow Control Mechanisms | Branch flow `feature -> develop -> main`, required reviews on protected branches (OSSF Scorecard `Branch-Protection` perfect score), DCO sign-off enforced ([test-dco.yml](.github/workflows/test-dco.yml)), `npm publish` gated on `npm-publish` GitHub Environment with required reviewers |
| CICD-SEC-2 | Inadequate Identity and Access Management | GitHub teams (`@middyjs/owners`, `@middyjs/reviewers`) per [docs/GOVERNANCE.md](docs/GOVERNANCE.md); all maintainers require WebAuthn MFA; OIDC tokens for npm publish (no static `NPM_TOKEN`) |
| CICD-SEC-3 | Dependency Chain Abuse | Lockfile committed with integrity hashes; `lockfile-lint` enforces npm-only HTTPS sources; `npm audit signatures` gates the build env in [release.yml](.github/workflows/release.yml); Trivy SCA + Dependabot weekly |
| CICD-SEC-4 | Poisoned Pipeline Execution | All workflows are file-versioned and reviewed via PR; zizmor + actionlint lint workflows on every PR ([test-sast.yml](.github/workflows/test-sast.yml)); third-party actions pinned by commit SHA |
| CICD-SEC-5 | Insufficient PBAC (Pipeline-Based Access Controls) | Scoped `permissions:` per job in every workflow; `step-security/harden-runner` audits runner egress; ephemeral GitHub-hosted runners only |
| CICD-SEC-6 | Insufficient Credential Hygiene | See [Secrets Policy](#secrets-policy) |
| CICD-SEC-7 | Insecure System Configuration | Runner hardening via `step-security/harden-runner` in every job; zizmor flags misconfigurations weekly |
| CICD-SEC-8 | Ungoverned Usage of Third-Party Services | See [OSS Component Policy](#oss-component-policy); third-party actions pinned by SHA; Trivy license scan enforces SPDX allowlist |
| CICD-SEC-9 | Improper Artifact Integrity Validation | SLSA L3 build provenance via `actions/attest-build-provenance` (Sigstore); `gh attestation verify` validates the tarball immediately before `npm publish`; npm `--provenance` round-trip |
| CICD-SEC-10 | Insufficient Logging and Visibility | GitHub Actions run logs (retained per org policy); OSSF Scorecard weekly results published to the Scorecard dashboard; `harden-runner` egress audit log per job |

## Secrets Policy

- No static publish tokens. `npm publish` uses GitHub OIDC (`id-token: write`) to obtain a short-lived registry token per release run.
- The only credential in the default workflow context is `GITHUB_TOKEN`, which GitHub auto-rotates per job and scopes via per-job `permissions:` declarations.
- Long-lived secrets required by specific workflows (`GITLEAKS_LICENSE`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`) are stored as GitHub Secrets and only injected as environment variables into the steps that need them. They are never written to logs (GitHub Actions auto-redacts registered secrets).
- No credentials are committed to the repository. Every PR is scanned by both TruffleHog (`--only-verified --results=verified,unknown`) and gitleaks; either tool failing blocks merge.
- Maintainer accounts require WebAuthn MFA (see [docs/GOVERNANCE.md](docs/GOVERNANCE.md)).
- A credential believed to be compromised follows the rotation procedure in [docs/INCIDENT-RESPONSE.md](docs/INCIDENT-RESPONSE.md).

## OSS Component Policy

- All runtime and development dependencies are declared in `package.json` files and pinned to integrity-hashed entries in the committed `package-lock.json`. `npm ci` is used everywhere (not `npm install`) so hashes are enforced on install.
- Dependency sources are restricted to the public npm registry over HTTPS. `lockfile-lint --allowed-hosts npm --validate-https` enforces this on every PR.
- Dependency signatures from the npm registry are verified by `npm audit signatures` in the `build` job of [release.yml](.github/workflows/release.yml), gating the build environment before any artifact is produced.
- Vulnerability scanning runs on every PR (Trivy SCA in [test-sast.yml](.github/workflows/test-sast.yml)) and weekly on schedule. Dependabot opens patch PRs weekly against `develop`.
- License compliance is enforced by Trivy license scan; permitted SPDX identifiers include 0BSD, Apache-2.0, BSD-1-Clause, BSD-2-Clause, BSD-3-Clause, CC0-1.0, CC-BY-4.0, ISC, MIT, Python-2.0. Any new dependency outside this set is rejected unless explicitly reviewed and added to the allowlist.
- Third-party GitHub Actions are pinned by full commit SHA with a version comment; Dependabot tracks updates. No `@main` / `@latest` action references.
- New dependencies must be added via PR and reviewed by at least one maintainer per [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Reporting a Vulnerability

The Middy OSS team and community take all security vulnerabilities
seriously. Thank you for improving the security of our open source
software. We appreciate your efforts and responsible disclosure and will
make every effort to acknowledge your contributions.

Report security vulnerabilities by emailing the lead maintainer at:
```
willfarrell@proton.me
```
The lead maintainer will acknowledge your email within 24 hours, and will
send a more detailed response within 48 hours indicating the next steps in
handling your report. After the initial reply to your report, the security
team will endeavour to keep you informed of the progress towards a fix and
full announcement, and may ask for additional information or guidance.

Report security vulnerabilities in third-party modules to the person or
team maintaining the module.

## Disclosure Policy

When the security team receives a security bug report, they will assign it
to a primary handler. This person will coordinate the fix and release
process, involving the following steps:

  * Confirm the problem and determine the affected versions.
  * Audit code to find any potential similar problems.
  * Prepare fixes for all releases still under maintenance. These fixes
    will be released as fast as possible to NPM.

## Pipeline Incident Response

For compromise of the CI/CD pipeline itself (maintainer account takeover, npm publish compromise, supply-chain dependency compromise), follow the runbook in [docs/INCIDENT-RESPONSE.md](docs/INCIDENT-RESPONSE.md). That document covers triage, containment, recovery, and post-incident review for pipeline-specific events. Application-level vulnerabilities continue to flow through the [Reporting a Vulnerability](#reporting-a-vulnerability) process above.

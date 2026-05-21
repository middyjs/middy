# Governance

## Roles

### [Owner](https://github.com/orgs/middyjs/teams/owners)

Also known as a core maintainer. Have a long history with the project, have a deep understanding of the codebase, and decide the direction of the project.

### [Reviewer](https://github.com/orgs/middyjs/teams/reviewers)

Group of people responsible for reviewing pull requests.

## Decisions

All discussion and decisions are documented in a GitHub Issue to allow transparency and community feedback. Video calls to go over larger decisions and those that relate to governance may happen periodically.

## Maintainers

- Project must maintain a minimum of 3 maintainers with at least two unassociated significant contributors
- All maintainers are required to have WebAuthn MFA enable on their account.
- Required to know secure design principals.

## Review cadence

The following reviews are scheduled to keep operational security practices current. Each is the responsibility of the [@middyjs/owners](https://github.com/orgs/middyjs/teams/owners) team unless otherwise noted.

| Cadence | Activity | Notes |
| --- | --- | --- |
| Weekly | Triage OSSF Scorecard scan results; review Dependabot PRs; review SAST + secret-scan findings | Automated via [ossf-scorecard.yml](../.github/workflows/ossf-scorecard.yml) and [test-sast.yml](../.github/workflows/test-sast.yml) |
| Per release | Confirm all gating checks pass (lint, unit, types, SAST, perf, DAST), provenance attestation issued, attestation verified before publish | Enforced in [release.yml](../.github/workflows/release.yml) |
| Quarterly | Audit GitHub org administrators; review `step-security/harden-runner` egress audit logs and tighten `egress-policy` from `audit` to `block` where stable; review GitHub Environment reviewers for the `npm-publish` environment | Owners team |
| Semi-annually | Review operational practices (this document, [SECURITY.md](../SECURITY.md), [docs/INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md), [docs/PIPELINE.md](PIPELINE.md)) for drift against current pipeline state | Owners team |
| Annually | Re-attest [docs/SPVS-COMPLIANCE.md](SPVS-COMPLIANCE.md) against the latest OWASP SPVS revision; review known-gaps list and close where feasible; run incident-response tabletop exercise per [docs/INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) | Owners team |

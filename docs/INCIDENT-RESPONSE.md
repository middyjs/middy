# Pipeline Incident Response

This runbook covers incident response for the middy CI/CD pipeline and supply chain. Application-level vulnerabilities continue to flow through the standard process in [SECURITY.md](../SECURITY.md#reporting-a-vulnerability).

It addresses [OWASP SPVS 1.5](SPVS-COMPLIANCE.md) controls V5.5.1, V5.5.2, and V5.5.3.

## Contacts

| Role | Reach |
| --- | --- |
| Lead maintainer (24h SLA) | `willfarrell@proton.me` |
| Owners team | [@middyjs/owners](https://github.com/orgs/middyjs/teams/owners) |
| npm package security | `security@npmjs.com` (npm Inc.) |
| GitHub security | `https://support.github.com` |

## Severity classification

| Severity | Definition | Example |
| --- | --- | --- |
| SEV-1 | Active compromise with confirmed unauthorised publish or push to `main` | A `@middy/*` package version has been published from a non-maintainer identity |
| SEV-2 | Credential or maintainer-account compromise without confirmed downstream impact | npm OIDC token leaked in a workflow log; maintainer account session token exposed |
| SEV-3 | High-confidence near-miss or dependency compromise in transit | A direct dependency has a confirmed registry signature mismatch (`npm audit signatures` failure on `develop`) |
| SEV-4 | Anomalous pipeline behaviour without confirmed compromise | Unexpected egress from a CI run flagged by `step-security/harden-runner` |

A SEV-1 or SEV-2 triggers this runbook end to end. SEV-3 and SEV-4 follow Triage and Investigation only unless they escalate.

## Phase 1 - Triage (target: under 1 hour from detection)

1. The first responder replies to the disclosure email and records the timestamp of detection.
2. Classify severity using the table above.
3. Identify the affected surface:
   - Which package(s) and version(s)?
   - Which workflow run(s)? (record the run URL)
   - Which identity (maintainer, bot, OIDC issuer)?
4. Open a private security advisory in the GitHub repository (`Security` -> `Advisories` -> `New draft security advisory`). All subsequent activity is logged in that advisory.

## Phase 2 - Contain (target: under 4 hours for SEV-1/2)

Apply the relevant containment path:

### A. Compromised maintainer account

1. Revoke the maintainer's GitHub personal access tokens, SSH keys, and active sessions via the GitHub org admin UI.
2. Remove the account from all `@middyjs/*` teams temporarily.
3. Force-reset MFA on the account; require WebAuthn re-enrolment before re-adding.
4. Audit `git log` since the account's last known-good activity for unexpected commits to `develop` or `main`; revert via PR if any are found.
5. Audit the GitHub audit log for any settings changes, environment-secret reads, or workflow edits made under the compromised identity.

### B. Compromised npm publish

1. Run `npm deprecate @middy/<pkg>@<version> 'security: compromised publish, do not use'` for every affected version. This signals to consumers immediately; full unpublish has a 72-hour window per npm policy.
2. If within the 72-hour unpublish window and no legitimate downloads have happened, run `npm unpublish @middy/<pkg>@<version>` to remove the tarball entirely.
3. Email `security@npmjs.com` with the package + version, advisory URL, and timeline. Request signature/provenance check on npm's side.
4. Revoke the OIDC trust by inspecting `release.yml`: confirm the `id-token: write` permission scope is intact and that no extra `repository_owner` trust was added. If a fork or rogue branch ran the publish, disable Actions on that ref and rotate.
5. Publish a patched version (`<version>+1`) with the fix and the standard provenance attestation flow.

### C. Compromised dependency in transit (`npm audit signatures` failure or upstream advisory)

1. Pin or remove the affected dependency immediately on `develop` via PR; do not merge to `main` until verified.
2. Inspect `package-lock.json` for the offending package's resolved URL and integrity hash; compare against the npm registry's current values.
3. If the compromise pre-dates the most recent release, follow path B as well (consumers downloaded the tainted dep transitively).
4. Re-run `npm audit signatures` and the full SAST/SCA suite on the patched lockfile before publishing.

### D. Workflow / runner compromise (zizmor / harden-runner alert escalates)

1. Disable any new or modified workflow in `.github/workflows/` via the GitHub Actions tab.
2. Re-pin all third-party actions by commit SHA from a known-good revision (compare against the most recent green `main`).
3. Tighten `step-security/harden-runner` `egress-policy` from `audit` to `block` for the affected workflow until investigation completes.

## Phase 3 - Investigate

1. Pull the GitHub Actions run logs for every workflow that touched the compromised surface in the 30 days prior.
2. Cross-reference with `step-security/harden-runner` egress audit logs for unexpected outbound destinations.
3. Confirm whether the npm registry's `dist.signatures` for affected versions match the build provenance attestation on file. A mismatch is conclusive evidence of tampering.
4. Document the root cause, blast radius, and detection path in the security advisory.

## Phase 4 - Recover

1. Rotate every secret in the GitHub repo and org that could have been read by the compromised identity (Actions secrets, environment secrets, deploy keys).
2. Re-publish patched package versions following the standard [release.yml](../.github/workflows/release.yml) flow. Confirm `gh attestation verify` and `npm audit signatures` pass before publish.
3. Verify the published version on a clean machine: `npm install @middy/<pkg>@<new-version>` and check `dist.signatures` via `npm view @middy/<pkg>@<new-version> --json`.
4. Communicate via the security advisory CVE and a GitHub release note. If consumer-facing impact is confirmed, also post to the project README badge area and to lead maintainer's published Mastodon/X account.

## Phase 5 - Post-incident review

Within two weeks of recovery:

1. Update this runbook with anything that did not work, was missing, or took longer than expected.
2. If a control failed (e.g. SAST missed the dep, harden-runner did not flag the egress), open an issue tagged `security` describing the gap and the proposed mechanism change.
3. Update [docs/SPVS-COMPLIANCE.md](SPVS-COMPLIANCE.md) if the incident changed how a control is implemented or evidenced.
4. Add a row to the Tabletop / Real Incident log below.

## Tabletop exercise schedule

A tabletop exercise is run annually (see [docs/GOVERNANCE.md](GOVERNANCE.md) review cadence). The exercise picks one of paths A through D above, walks through each phase with a notional timeline, and records gaps without changing production state.

## Tabletop / Real Incident log

| Date | Type | Path | Outcome | Follow-up |
| --- | --- | --- | --- | --- |
| _none yet_ |  |  |  |  |

# Pipeline Incident Response

This runbook covers incident response for the middy CI/CD pipeline and supply chain. Application-level vulnerabilities continue to flow through the standard process in [SECURITY.md](../SECURITY.md#reporting-a-vulnerability).

It addresses [OWASP SPVS](SPVS-COMPLIANCE.md) core controls V5.5.1, V5.5.2, and V5.5.3, and 1.6 supply-chain controls V5.2.4 and V5.3.1.

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
| SEV-2 | Credential or maintainer-account compromise without confirmed downstream impact | npm OIDC token leaked in a workflow log; maintainer account session token exposed; a malicious version staged via `npm stage publish` but not yet approved (nothing live) |
| SEV-3 | High-confidence near-miss or dependency compromise in transit | A direct dependency has a confirmed registry signature mismatch (`npm audit signatures` failure on `develop`) |
| SEV-4 | Anomalous pipeline behaviour without confirmed compromise | Unexpected egress from a CI run flagged by `step-security/harden-runner` |

A SEV-1 or SEV-2 triggers this runbook end to end. SEV-3 and SEV-4 follow Triage and Investigation only unless they escalate.

## Phase 1 - Triage (target: under 1 hour from detection)

1. The first responder acknowledges the report (email reply, or a comment on the public issue) and records the timestamp of detection.
2. Classify severity using the table above, using its SEV terms.
3. Identify the affected surface:
   - Which package(s) and version(s)? Enumerate the entire `@middy` scope for unexpected versions, not just the reported package.
   - Which workflow run(s)? (record the run URL; if no run produced the version, the compromise is off-pipeline - see Phase 3 step 4)
   - Which identity? The registry metadata (`npm view <pkg>@<version> --json`) records the publishing account in `_npmUser`.
4. Preserve evidence before any takedown: download the affected tarball(s) and save the full registry metadata JSON for each. Once npm removes a version, forensics on it are gone.
5. Open a private security advisory in the GitHub repository (`Security` -> `Advisories` -> `New draft security advisory`). All subsequent activity is logged in that advisory. If detection arrived via a public channel, also post a short public holding statement (confirmed, affected versions, do not install, advisory to follow) and keep all working detail private until containment completes.

## Phase 2 - Contain (target: under 4 hours for SEV-1/2)

Apply the relevant containment path:

### A. Compromised maintainer account

1. Revoke the maintainer's GitHub personal access tokens, SSH keys, and active sessions via the GitHub org admin UI.
2. Remove the account from all `@middyjs/*` teams temporarily.
3. Force-reset MFA on the account; require WebAuthn re-enrolment before re-adding.
4. Audit `git log` since the account's last known-good activity for unexpected commits to `develop` or `main`; revert via PR if any are found.
5. Audit the GitHub audit log for any settings changes, environment-secret reads, or workflow edits made under the compromised identity.
6. Audit the account's npm side as well: pending staged versions it created and recent stage approvals it made (`npm stage list` per package; approval history via npmjs.com). Leave suspect staged versions unapproved, and if a rogue approval already went live, continue with path B.

### B. Compromised npm publish

0. Check the stage queue first: `npm stage list @middy/<pkg>` for every package. A malicious version still in the staged state has shipped nothing: record its metadata as evidence (`npm stage list --json`: id, packageName, version, actor, shasum), then remove it with `npm stage reject <stage-id>` and treat the incident as SEV-2. The queue is also a tripwire: a staged version nobody expects means someone holds stage-publish capability.
1. Run `npm deprecate @middy/<pkg>@<version> 'security: compromised publish, do not use'` for every affected version that went live. This signals to consumers immediately and has no policy gate.
2. Repoint `latest`: `npm dist-tag add @middy/<pkg>@<last-good-version> latest` for every affected package. This is the fastest consumer protection available and requires no publish.
3. Stop further publishes without waiting to learn the leak vector: set every `@middy` scope member to read-only except one verified-clean owner account; every maintainer revokes their npm access tokens and rotates credentials from a known-clean machine; delete all classic/granular automation tokens.
4. Email `security@npmjs.com` with the package + version, advisory URL, and timeline. Request a lock on the publishing account, the authentication method used (token type, source IP), and a malware takedown - npm replaces affected versions with a security placeholder and flags them for `npm audit`. Direct `npm unpublish` is only possible inside the 72-hour window; assume real incidents always have downloads, so the takedown request is the normal path.
5. Check the OIDC trust by inspecting `release.yml`: confirm the `id-token: write` permission scope is intact and that no extra `repository_owner` trust was added. If a fork or rogue branch ran the publish, disable Actions on that ref and rotate.
6. Publish a patched version with the fix through the standard provenance attestation flow. Compromised version numbers are permanently burned even after takedown; bump past them.
7. Approval hygiene, during and after any incident: `npm run release:approve` only approves staged ids whose version matches the checked-out release (`$npm_package_version`), but an attacker who staged under that exact version would ride along. Before approving, run `npm run release:audit` (lists every staged entry with actor and shasum, fails on version mismatches) and confirm the entries are the release run you expect. Anything unexpected gets `npm stage reject` and reopens this runbook.

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
3. Confirm whether the npm registry's `dist.signatures` for affected versions match the build provenance attestation on file. A mismatch, or the complete absence of provenance on a version claiming to be ours, is conclusive evidence of tampering.
4. If no pipeline run produced the affected versions, the compromise is off-pipeline: steps 1-2 will come back empty and serve only to rule the pipeline out. Request the authentication details from npm security (path B step 4), treat the publishing maintainer's workstation as compromised (infostealer, or a trojaned `npm install` in an unrelated project), and sweep every other package and organisation that maintainer can publish to for the same pattern.
5. Document the root cause, blast radius, and detection path in the security advisory.

## Phase 4 - Recover

1. Rotate every secret in the GitHub repo and org that could have been read by the compromised identity (Actions secrets, environment secrets, deploy keys). Revoke each compromised credential before its replacement is activated, within the containment SLO.
2. Re-publish patched package versions following the standard [release.yml](../.github/workflows/release.yml) flow. Confirm `gh attestation verify` and `npm audit signatures` pass before publish.
3. Verify the published version on a clean machine: `npm install @middy/<pkg>@<new-version>` and check `dist.signatures` via `npm view @middy/<pkg>@<new-version> --json`.
4. Communicate via the security advisory CVE and a GitHub release note. State plainly what consumers must do: if the payload harvested credentials, installing an affected version means their npm tokens, `~/.npmrc`, and CI secrets are compromised and must be rotated. If consumer-facing impact is confirmed, also post to the project README badge area and to lead maintainer's published Mastodon/X account.

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
| 2026-08-21 | Tabletop | B | 7 runbook gaps found and folded into this document the same day: evidence preservation, npm-account containment, publisher identification via registry metadata, public-detection comms, unrealistic unpublish condition, dist-tag repointing, off-pipeline investigation branch. | DONE 2026-08-21: release.yml publishes via `npm stage publish`; registry-side trusted publisher set to stage-only with token publish disallowed for `@middy` packages; maintainer approves with the version-filtered `npm run release:approve` (2FA). Detection: stage queue tripwire (path B step 0) + npm publish notification emails |

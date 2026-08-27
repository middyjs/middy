# Maintainer Workstation Security

Policy for machines used to maintain middy. It complements the repo-side controls in [PIPELINE.md](PIPELINE.md) and addresses SPVS 1.6 V1.3.1-V1.3.5 and SPVS core V1.2.x. Compliance is attested by each maintainer; the policy is reviewed semi-annually per [GOVERNANCE.md](GOVERNANCE.md).

## Baseline (core V1.2)

- Full-disk encryption enabled.
- Endpoint protection running with automatic updates.
- OS automatic patching enabled.
- Auto-lock after at most 5 minutes of inactivity.

## Developer tools and extensions (V1.3.1, V1.3.3)

- Development tools are installed from official distribution channels only and kept current.
- Editor extensions are installed only after review; extension auto-update is disabled, and updates are applied deliberately (release notes checked) during the weekly review.
- The installed tool and extension inventory is reviewed semi-annually; anything unrecognised is removed and investigated.

## Tool egress governance (V1.3.2)

- An outbound application firewall (e.g. LuLu or Little Snitch) runs in alert-on-new-destination mode. A developer tool contacting an unexpected destination is denied and investigated per [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md).
- Destination policy: developer tools may reach package registries (`registry.npmjs.org`), VCS hosts (`github.com`), and vendor update endpoints explicitly accepted into the firewall ruleset. The ruleset is reviewed semi-annually.

## Toolchain isolation (V1.3.4)

- npm >= 12 everywhere, so package install scripts are disabled by default (the repo pins this via the `packageManager` field).
- No long-lived registry tokens in `~/.npmrc`; publishing is OIDC-only from CI. Stale tokens are deleted on sight.
- Credentials live in the OS keychain or a password manager, never in dotfiles or environment files (see [SECURITY.md Secrets Policy](../SECURITY.md#secrets-policy)).

## Workspace trust (V1.3.5)

- Editor workspace-trust (restricted mode) stays enabled; cloned or downloaded repositories run no tasks, hooks, or container init until trust is granted explicitly per workspace.

# Maintainer Workstation Security

Policy for machines used to maintain middy. It complements the repo-side controls in [PIPELINE.md](PIPELINE.md) and addresses SPVS 1.6 V1.3.1-V1.3.5 and SPVS core V1.2.x. Compliance is attested by each maintainer; the policy is reviewed semi-annually per [GOVERNANCE.md](GOVERNANCE.md).

## Baseline (core V1.2)

- Full-disk encryption enabled.
- Endpoint protection running with automatic updates.
- OS automatic patching enabled.
- Auto-lock after at most 5 minutes of inactivity.

## Developer tools and extensions (V1.3.1, V1.3.3)

- Development tools are installed from official distribution channels only, and IDEs and editors stay on a vendor-supported version, updated within 30 days of a new release.
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

## AI coding assistants (SPVS 2.0 V1.6.10, V1.7.2, V1.7.4, V2.4.1, V2.5.3, V3.6.5, V4.5.3, V4.5.4, V5.6.1)

- Scope: AI agents run on contributor workstations only. No workflow in `.github/workflows/` calls a model or runs an agent. Adding one requires a governance review and an update to [SPVS-COMPLIANCE.md](SPVS-COMPLIANCE.md) before it merges.
- Tool choice: contributors may use any AI coding assistant. The contributor is responsible for choosing a tool whose data-handling terms (what code is sent, whether it is used for training, how long it is kept) they accept. middy's source is public, so the risk to manage is secrets and private data, not code disclosure.
- Inventory: maintainers include the AI tools and MCP servers they use in the semi-annual tool and extension inventory review above.
- Secrets: never put secrets, tokens, or private data into prompts, agent configuration, issues, or PR text. Agents are not given registry or cloud credentials. Agent configuration committed to the repo (for example `CLAUDE.md` or `AGENTS.md`) is reviewed for secrets like any other file and is scanned by gitleaks and TruffleHog in CI.
- Limits: agents must not commit, push, approve or merge pull requests, change rulesets or branch protection, create releases, or publish packages. The contributor running an agent is accountable for every change it produces.
- Enforcement: agent output is treated as untrusted contributor input and passes the same server-side gates as any change: required status checks, 2 approvals plus code owner review on `main`, owner-only review of `.github/`, `.husky/`, and agent configuration via [CODEOWNERS](../.github/CODEOWNERS), and staged npm publishing that needs a maintainer 2FA approval (see [RELEASE.md](RELEASE.md)).
- Local agent state (`.agents/`) is gitignored and never committed.

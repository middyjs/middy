# Branch and tag rulesets (as code)

GitHub Repository Rulesets for `middyjs/middy`, version-controlled here so changes go through PR review and the live state can be diffed against this directory.

Addresses [docs/SPVS-COMPLIANCE.md](../../docs/SPVS-COMPLIANCE.md) follow-up under "Branch-protection-as-code".

## Files

| File | Target | Summary |
| --- | --- | --- |
| `develop.json` | branch `refs/heads/develop` | Deletion + non-fast-forward blocked, signed commits required |
| `main.json` | default branch (`main`) | Everything in `develop` plus: PR with 2 approvals, CODEOWNERS review, stale-review dismissal, last-push approval, required status checks (full CI matrix), CodeQL + zizmor code-scanning thresholds |
| `version.json` | tags (all) | Deletion + non-fast-forward blocked |

All rulesets are at repo scope (`source_type: "Repository"`), enforcement `active`, with no bypass actors. `bypass_actors: []` means even repo admins follow the rules; combined with `current_user_can_bypass: never` set on the live ruleset, this is the strictest configuration.

## Diff live state vs. this directory

```bash
gh api repos/middyjs/middy/rulesets/<id> \
  | jq 'del(.id,.node_id,._links,.created_at,.updated_at,.source,.source_type,.current_user_can_bypass)' \
  | diff -u - .github/rulesets/<name>.json
```

Ruleset IDs live on the live ruleset list:

```bash
gh api repos/middyjs/middy/rulesets | jq '.[] | {id,name,target}'
```

## Apply a change

1. Edit the JSON in this directory via PR. The PR is reviewed like any other code change.
2. After merge, update the live ruleset via API:

```bash
gh api -X PUT repos/middyjs/middy/rulesets/<id> \
  --input .github/rulesets/<name>.json
```

(`gh api -X POST repos/middyjs/middy/rulesets --input <file>` creates a new ruleset; PUT updates an existing one in place.)

## Re-export current live state

```bash
for r in $(gh api repos/middyjs/middy/rulesets | jq -r '.[] | "\(.id):\(.name)"'); do
  id=${r%%:*}; name=${r#*:}
  gh api repos/middyjs/middy/rulesets/$id \
    | jq 'del(.id,.node_id,._links,.created_at,.updated_at,.source,.source_type,.current_user_can_bypass)' \
    > .github/rulesets/${name}.json
done
./node_modules/.bin/biome format --write .github/rulesets/*.json
```

Run this after intentional UI changes to keep the repo in sync. Drift between live and this directory is itself a finding to triage.

## What this does *not* cover

- The `npm-publish` GitHub Environment (Settings -> Environments) is configured in the UI; it is referenced from [release.yml](../workflows/release.yml) but the Environment's reviewer list is not yet exported here.
- Org-level settings (org admin MFA, default workflow permissions, etc.) live at the `middyjs` org and are out of scope for this repo directory.

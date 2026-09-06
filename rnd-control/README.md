# R&D Airtable Sync

Central GitHub -> Airtable checklog sync for the `Alvin R&D OS` base.

## What it does

- Scans configured repositories for recent commits.
- Groups activity by project and Asia/Bangkok calendar day.
- Creates or updates one Airtable Checklog per project/day.
- Stores Git source, SHA and activity links.
- Updates Workstreams `Last Update` and `Last Git Sync`.
- Ignores `chore(rnd):` and `automation(rnd):` commits so the sync system does not log its own maintenance.

## Schedule

GitHub Actions runs daily at 00:15 Asia/Bangkok and can also be triggered manually with a custom lookback window.

## Required secret

Repository Settings -> Secrets and variables -> Actions:

- `AIRTABLE_TOKEN`: Airtable Personal Access Token with record read/write access to base `app9IpgoLjTQYwsW4`.

Optional:

- `GH_SYNC_TOKEN`: use only if a tracked repository is private or not readable by the workflow's default `GITHUB_TOKEN`.

## Known access limitation

`AI20K-Build-Phase-Cohort-3/P-112` is kept in `projects.json`, but the currently connected GitHub identity returns 404 for that repository. The sync will print a skip line and continue syncing the other projects. Give the token read access to that org/repository to enable P-112 sync.

## Files

- `projects.json`: repository -> Airtable Workstream mapping.
- `sync_airtable.py`: idempotent daily sync logic.
- `.github/workflows/rnd-airtable-sync.yml`: scheduler / manual trigger.

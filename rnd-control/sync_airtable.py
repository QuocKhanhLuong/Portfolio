from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

CONFIG = json.loads(Path(__file__).with_name("projects.json").read_text())
AIRTABLE_TOKEN = os.environ["AIRTABLE_TOKEN"]
GITHUB_TOKEN = os.environ.get("GH_SYNC_TOKEN") or os.environ.get("GITHUB_TOKEN", "")
LOOKBACK_HOURS = int(os.environ.get("LOOKBACK_HOURS", "30"))

BASE_ID = CONFIG["base_id"]
WORKSTREAMS_TABLE = CONFIG["workstreams_table"]
CHECKLOGS_TABLE = CONFIG["checklogs_table"]
PROJECTS = CONFIG["projects"]
LOCAL_TZ = ZoneInfo(CONFIG.get("timezone", "Asia/Bangkok"))
IGNORED_MESSAGE_PREFIXES = ("chore(rnd):", "automation(rnd):")
COMMIT_URL_RE = re.compile(r"/commit/([0-9a-f]{40})", re.IGNORECASE)


def http_json(url: str, *, method: str = "GET", headers=None, body=None):
    h = {"Accept": "application/vnd.github+json"}
    if headers:
        h.update(headers)
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        payload = r.read().decode()
        return json.loads(payload) if payload else {}


def gh(path: str):
    headers = {"X-GitHub-Api-Version": "2022-11-28"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return http_json("https://api.github.com" + path, headers=headers)


def at(method: str, table: str, body=None, query=None):
    url = f"https://api.airtable.com/v0/{BASE_ID}/{urllib.parse.quote(table)}"
    if query:
        url += "?" + urllib.parse.urlencode(query, doseq=True)
    return http_json(
        url,
        method=method,
        headers={"Authorization": f"Bearer {AIRTABLE_TOKEN}", "Content-Type": "application/json"},
        body=body,
    )


def all_airtable_records(table: str):
    records = []
    offset = None
    while True:
        query = {"pageSize": 100}
        if offset:
            query["offset"] = offset
        payload = at("GET", table, query=query)
        records.extend(payload.get("records", []))
        offset = payload.get("offset")
        if not offset:
            return records


def workstreams():
    return {
        r["fields"].get("Name"): r
        for r in all_airtable_records(WORKSTREAMS_TABLE)
        if r["fields"].get("Name")
    }


def local_day_from_airtable_date(value: str | None):
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ).date().isoformat()


def existing_git_state():
    seen_shas = set()
    daily_records = {}
    for r in all_airtable_records(CHECKLOGS_TABLE):
        fields = r.get("fields", {})
        source = fields.get("Source")
        source_name = source.get("name") if isinstance(source, dict) else source
        title = fields.get("Log Title", "")
        if source_name != "GitHub" and not title.startswith(("Git sync — ", "Git backfill — ")):
            continue

        sha = fields.get("Git SHA")
        if sha:
            seen_shas.add(sha.lower())
        for match in COMMIT_URL_RE.finditer(fields.get("Links", "") or ""):
            seen_shas.add(match.group(1).lower())

        workstream_name = fields.get("Workstream Name")
        day = local_day_from_airtable_date(fields.get("Date"))
        if workstream_name and day:
            daily_records[(workstream_name, day)] = r
    return seen_shas, daily_records


def commit_groups(repo: str, since: datetime):
    owner, name = repo.split("/", 1)
    groups = defaultdict(list)
    page = 1
    while True:
        q = urllib.parse.urlencode({"since": since.isoformat(), "per_page": 100, "page": page})
        commits = gh(f"/repos/{owner}/{name}/commits?{q}")
        if not commits:
            break
        for c in commits:
            dt_utc = datetime.fromisoformat(c["commit"]["committer"]["date"].replace("Z", "+00:00"))
            local_day = dt_utc.astimezone(LOCAL_TZ).date().isoformat()
            groups[local_day].append(c)
        if len(commits) < 100 or page >= 10:
            break
        page += 1
    return groups


def is_noise_commit(commit):
    head = commit["commit"]["message"].splitlines()[0].strip().lower()
    return any(head.startswith(prefix) for prefix in IGNORED_MESSAGE_PREFIXES)


def title_from_messages(messages):
    heads = []
    for m in messages:
        line = m.splitlines()[0].strip()
        if line and not line.lower().startswith("merge "):
            heads.append(line)
    return "; ".join(heads[:4]) or "GitHub activity"


def merge_lines(existing: str, additions: list[str], limit: int = 24):
    lines = [line for line in (existing or "").splitlines() if line.strip()]
    for line in additions:
        if line not in lines:
            lines.append(line)
    return "\n".join(lines[-limit:])


def main():
    since = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
    ws = workstreams()
    seen_shas, daily_records = existing_git_state()
    new_logs = []
    log_updates = []
    touched = {}

    for repo, workstream_name in PROJECTS.items():
        if workstream_name not in ws:
            print(f"skip {repo}: workstream not found: {workstream_name}")
            continue
        try:
            groups = commit_groups(repo, since)
        except urllib.error.HTTPError as e:
            print(f"skip {repo}: GitHub HTTP {e.code}")
            continue

        for day, commits in sorted(groups.items()):
            fresh = [
                c for c in commits
                if c["sha"].lower() not in seen_shas and not is_noise_commit(c)
            ]
            if not fresh:
                continue

            fresh.sort(key=lambda c: c["commit"]["committer"]["date"], reverse=True)
            messages = [c["commit"]["message"] for c in fresh]
            shas = [c["sha"].lower() for c in fresh]
            urls = [c["html_url"] for c in fresh]
            summary = title_from_messages(messages)
            last = fresh[0]
            last_dt = last["commit"]["committer"]["date"]
            key = (workstream_name, day)

            additions_done = [f"- {m.splitlines()[0]}" for m in messages[:12]]
            if key in daily_records:
                existing = daily_records[key]
                ef = existing.get("fields", {})
                log_updates.append({
                    "id": existing["id"],
                    "fields": {
                        "Date": last_dt,
                        "Summary": summary,
                        "Done": merge_lines(ef.get("Done", ""), additions_done),
                        "Links": merge_lines(ef.get("Links", ""), urls[:12]),
                        "Source": "GitHub",
                        "Git SHA": shas[0],
                        "Git Activity URL": urls[0],
                    },
                })
            else:
                new_logs.append({
                    "fields": {
                        "Log Title": f"Git sync — {workstream_name} — {day}",
                        "Date": last_dt,
                        "Workstream Name": workstream_name,
                        "Workstream": [ws[workstream_name]["id"]],
                        "Log Type": "Progress",
                        "Summary": summary,
                        "Done": "\n".join(additions_done),
                        "Links": "\n".join(urls[:12]),
                        "Tags": ["code"],
                        "Source": "GitHub",
                        "Git SHA": shas[0],
                        "Git Activity URL": urls[0],
                    }
                })

            seen_shas.update(shas)
            touched[workstream_name] = max(touched.get(workstream_name, last_dt), last_dt)

    for i in range(0, len(new_logs), 10):
        at("POST", CHECKLOGS_TABLE, {"records": new_logs[i:i + 10], "typecast": True})
    for i in range(0, len(log_updates), 10):
        at("PATCH", CHECKLOGS_TABLE, {"records": log_updates[i:i + 10], "typecast": True})

    for name, dt in touched.items():
        record = ws[name]
        local_day = datetime.fromisoformat(dt.replace("Z", "+00:00")).astimezone(LOCAL_TZ).date().isoformat()
        at(
            "PATCH",
            WORKSTREAMS_TABLE,
            {
                "records": [{
                    "id": record["id"],
                    "fields": {"Last Update": local_day, "Last Git Sync": dt},
                }],
                "typecast": True,
            },
        )

    print(
        f"created {len(new_logs)} daily checklogs, updated {len(log_updates)}, "
        f"touched {len(touched)} workstreams"
    )


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

CONFIG = json.loads(Path(__file__).with_name("projects.json").read_text())
AIRTABLE_TOKEN = os.environ["AIRTABLE_TOKEN"]
GITHUB_TOKEN = os.environ.get("GH_SYNC_TOKEN") or os.environ.get("GITHUB_TOKEN", "")
LOOKBACK_HOURS = int(os.environ.get("LOOKBACK_HOURS", "30"))

BASE_ID = CONFIG["base_id"]
WORKSTREAMS_TABLE = CONFIG["workstreams_table"]
CHECKLOGS_TABLE = CONFIG["checklogs_table"]
PROJECTS = CONFIG["projects"]


def http_json(url: str, *, method: str = "GET", headers=None, body=None):
    h = {"Accept": "application/vnd.github+json"}
    if headers:
        h.update(headers)
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def gh(path: str):
    headers = {}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
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


def workstreams():
    rows = at("GET", WORKSTREAMS_TABLE, query={"pageSize": 100}).get("records", [])
    return {r["fields"].get("Name"): r for r in rows}


def existing_shas():
    rows = at("GET", CHECKLOGS_TABLE, query={"pageSize": 100}).get("records", [])
    return {r["fields"].get("Git SHA") for r in rows if r["fields"].get("Git SHA")}


def commit_groups(repo: str, since: datetime):
    owner, name = repo.split("/", 1)
    q = urllib.parse.urlencode({"since": since.isoformat(), "per_page": 100})
    commits = gh(f"/repos/{owner}/{name}/commits?{q}")
    groups = defaultdict(list)
    for c in commits:
        dt = datetime.fromisoformat(c["commit"]["committer"]["date"].replace("Z", "+00:00"))
        groups[dt.date().isoformat()].append(c)
    return groups


def title_from_messages(messages):
    heads = []
    for m in messages:
        line = m.splitlines()[0].strip()
        if line and not line.lower().startswith("merge "):
            heads.append(line)
    return "; ".join(heads[:4]) or "GitHub activity"


def main():
    since = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
    ws = workstreams()
    seen = existing_shas()
    new_logs = []
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
            fresh = [c for c in commits if c["sha"] not in seen]
            if not fresh:
                continue
            messages = [c["commit"]["message"] for c in fresh]
            shas = [c["sha"] for c in fresh]
            urls = [c["html_url"] for c in fresh]
            summary = title_from_messages(messages)
            last = fresh[0]
            fields = {
                "Log Title": f"Git sync — {workstream_name} — {day}",
                "Date": last["commit"]["committer"]["date"],
                "Workstream Name": workstream_name,
                "Workstream": [ws[workstream_name]["id"]],
                "Log Type": "Progress",
                "Summary": summary,
                "Done": "\n".join(f"- {m.splitlines()[0]}" for m in messages[:12]),
                "Links": "\n".join(urls[:12]),
                "Tags": ["code"],
                "Source": "GitHub",
                "Git SHA": shas[0],
                "Git Activity URL": urls[0],
            }
            new_logs.append({"fields": fields})
            touched[workstream_name] = (last["commit"]["committer"]["date"], summary)

    for i in range(0, len(new_logs), 10):
        at("POST", CHECKLOGS_TABLE, {"records": new_logs[i:i+10], "typecast": True})

    for name, (dt, summary) in touched.items():
        record = ws[name]
        at("PATCH", WORKSTREAMS_TABLE, {
            "records": [{
                "id": record["id"],
                "fields": {
                    "Last Update": dt[:10],
                    "Last Git Sync": dt,
                    "Current Focus": summary,
                },
            }],
            "typecast": True,
        })

    print(f"created {len(new_logs)} daily checklogs across {len(touched)} workstreams")


if __name__ == "__main__":
    main()

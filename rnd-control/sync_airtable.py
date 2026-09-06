"""Đồng bộ commit nhánh mặc định → nhật ký Airtable; không suy diễn tiến độ.

Chỉ dùng thư viện chuẩn. Import không cần token, không gọi mạng.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

W = {"name": "fldctlrMpRfJHyvZr", "updated": "fldBLKukWIsYR3OeJ", "sync": "fldlKFr2PRsDFRxpr"}
L = {
    "title": "fldqXHKOVhCuWFpvd", "date": "fld0TbicQgBetPRm5",
    "name": "fldAzl3CJqKzEEAFx", "workstream": "fldla06XxuW45bksG",
    "type": "fld6XrgSZED3P38Lb", "summary": "fldmqQoXrlQh3U2oP",
    "done": "fldXliE3FSKHJKdpY", "links": "fld0hIntLDDyFX4Z0",
    "source": "fldWyyXHx9LWkvMOp", "sha": "fldCExatqfCQFbAgQ",
    "url": "fldA7X4mVhtELQljD", "key": "fldyY3GUL0Cf19Ilc",
    "raw": "fldOgT3vcnI9Uo1y6",
}
NOISE = ("chore(rnd):", "automation(rnd):", "style:", "style(")
KINDS = {"feat": "Tính năng", "fix": "Sửa lỗi", "docs": "Tài liệu",
         "test": "Mã kiểm thử", "ci": "Cấu hình CI", "perf": "Tối ưu",
         "refactor": "Tổ chức lại mã", "build": "Cấu hình xây dựng", "chore": "Bảo trì"}
COMMIT_URL = re.compile(r"https://github\.com/([^/]+/[^/]+)/commit/([0-9a-f]{40})", re.I)
AUTO_MARK = "\n\nBổ sung từ lần đồng bộ tự động: "
MAX_TEXT = 95000


class SyncError(RuntimeError):
    """Lỗi an toàn để ghi báo cáo, không chứa token hoặc nội dung phản hồi."""


def dt(value: str) -> datetime:
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)
    return result.astimezone(timezone.utc)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def name(value: Any) -> str:
    return value.get("name", "") if isinstance(value, dict) else str(value or "")


def key_for(repo: str, day: str) -> str:
    return f"github:{repo.lower()}:{day}"


def http_json(url: str, *, method: str = "GET", headers=None, body=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    host = urllib.parse.urlparse(url).hostname
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                raw = response.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            # GET and PATCH/upsert are the only operations used; retries are idempotent.
            if exc.code in (429, 500, 502, 503, 504) and attempt < 3:
                retry_after = (exc.headers or {}).get("Retry-After", "")
                delay = int(retry_after) if retry_after.isdigit() else (31 if exc.code == 429 else 2 ** attempt)
                time.sleep(min(delay, 60))
                continue
            raise SyncError(f"{host}: HTTP {exc.code}; kiểm tra quyền, token hoặc hạn mức") from None
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise SyncError(f"{host}: lỗi kết nối sau các lần thử giới hạn") from None
    raise SyncError("Hết số lần thử HTTP")


class Client:
    def __init__(self, config: dict, airtable_token: str, github_token: str = ""):
        self.config = config
        self.airtable_token = airtable_token
        self.github_token = github_token
        self.last_airtable_call = 0.0

    def gh(self, path: str):
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if self.github_token:
            headers["Authorization"] = f"Bearer {self.github_token}"
        return http_json("https://api.github.com" + path, headers=headers)

    def at(self, table: str, *, method="GET", body=None, query=None):
        time.sleep(max(0.0, 0.25 - (time.monotonic() - self.last_airtable_call)))
        self.last_airtable_call = time.monotonic()
        url = f"https://api.airtable.com/v0/{self.config['base_id']}/{urllib.parse.quote(table, safe='')}"
        if query:
            url += "?" + urllib.parse.urlencode(query, doseq=True)
        return http_json(url, method=method, body=body, headers={
            "Accept": "application/json", "Content-Type": "application/json",
            "Authorization": f"Bearer {self.airtable_token}",
        })

    def records(self, table: str, field_ids: list[str]):
        rows, seen_offsets = [], set()
        offset = None
        while True:
            query = {"pageSize": 100, "returnFieldsByFieldId": "true", "fields[]": field_ids}
            if offset:
                query["offset"] = offset
            result = self.at(table, query=query)
            rows.extend(result["records"])
            offset = result.get("offset")
            if not offset:
                return rows
            if offset in seen_offsets:
                raise SyncError("Airtable trả con trỏ lặp; dừng để tránh mất dữ liệu")
            seen_offsets.add(offset)

    def commits(self, repo: str, since: datetime, until: datetime):
        metadata = self.gh(f"/repos/{repo}")
        branch = metadata["default_branch"]
        rows = []
        for page in range(1, 51):
            query = urllib.parse.urlencode({"sha": branch, "since": iso(since), "until": iso(until),
                                           "per_page": 100, "page": page})
            chunk = self.gh(f"/repos/{repo}/commits?{query}")
            if not isinstance(chunk, list):
                raise SyncError("GitHub không trả danh sách commit hợp lệ")
            rows.extend(chunk)
            if len(chunk) < 100:
                return rows
        raise SyncError("Cửa sổ vượt 5.000 commit; chia nhỏ khoảng thời gian, chưa đánh dấu đồng bộ xong")

    def upsert_log(self, fields: dict):
        return self.at(self.config["checklogs_table"], method="PATCH", body={
            "performUpsert": {"fieldsToMergeOn": [L["key"]]},
            "records": [{"fields": fields}], "typecast": False,
        })

    def update_workstream(self, record_id: str, fields: dict):
        return self.at(self.config["workstreams_table"], method="PATCH", body={
            "records": [{"id": record_id, "fields": fields}], "typecast": False,
        })


def normalize_commit(commit: dict) -> dict:
    message = (commit["commit"].get("message") or "").splitlines()
    return {"sha": commit["sha"].lower(), "date": iso(dt(commit["commit"]["committer"]["date"])),
            "message": (message[0] if message else "").strip()[:1000], "url": commit["html_url"]}


def is_noise(commit: dict) -> bool:
    head = commit["message"].lower()
    return not head or head.startswith(NOISE)


def raw_state(fields: dict) -> dict:
    text = fields.get(L["raw"])
    if not text:
        return {"schema": 1, "commits": [], "curated": False}
    try:
        state = json.loads(text)
        if state.get("schema") != 1 or not isinstance(state.get("commits"), list):
            raise ValueError()
        for event in state["commits"]:
            if not re.fullmatch(r"[0-9a-f]{40}", event["sha"], re.I):
                raise ValueError()
            dt(event["date"])
        return state
    except (ValueError, TypeError, KeyError, AttributeError):
        raise SyncError("Dữ liệu Git gốc không hợp lệ; giữ nguyên nhật ký để kiểm tra") from None


def existing_state(rows: list[dict], repo: str, workstream_id: str):
    seen, daily = set(), {}
    for row in rows:
        fields = row.get("fields", {})
        links = fields.get(L["workstream"], [])
        ids = [v["id"] if isinstance(v, dict) else v for v in links]
        if workstream_id not in ids or name(fields.get(L["source"])) != "GitHub":
            continue
        key = fields.get(L["key"], "")
        if key and not key.startswith(f"github:{repo.lower()}:"):
            continue
        state = raw_state(fields)
        if state.get("repo") and state["repo"].lower() != repo.lower():
            continue
        if fields.get(L["sha"]):
            seen.add(fields[L["sha"]].lower())
        for match in COMMIT_URL.finditer(fields.get(L["links"], "") or ""):
            if match.group(1).lower() == repo.lower():
                seen.add(match.group(2).lower())
        seen.update(c["sha"].lower() for c in state["commits"])
        if key:
            if key in daily:
                raise SyncError("Trùng khóa đồng bộ đã tồn tại; không tự gộp hoặc xóa nhật ký")
            daily[key] = row
    return seen, daily


def classify(events: list[dict]) -> str:
    counts = Counter()
    for event in events:
        match = re.match(r"([a-z]+)(?:\([^)]*\))?!?:", event["message"].lower())
        kind = KINDS.get(match.group(1), "Thay đổi khác") if match else "Thay đổi khác"
        counts[kind] += 1
    return "; ".join(f"{label}: {count}" for label, count in sorted(counts.items()))


def plan_log(repo: str, workstream: dict, day: str, fresh: list[dict], existing=None) -> dict:
    ef = (existing or {}).get("fields", {})
    state = raw_state(ef)
    events = {c["sha"].lower(): c for c in state["commits"]}
    events.update({c["sha"]: c for c in fresh})
    ordered = sorted(events.values(), key=lambda c: (dt(c["date"]), c["sha"]), reverse=True)
    latest = max([dt(c["date"]) for c in ordered] + ([dt(ef[L["date"]])] if ef.get(L["date"]) else []))
    latest_event = ordered[0]
    if ef.get(L["date"]) and dt(ef[L["date"]]) > dt(latest_event["date"]):
        latest_event = {"sha": ef.get(L["sha"], latest_event["sha"]), "url": ef.get(L["url"], latest_event["url"])}
    state.update({"schema": 1, "repo": repo, "commits": ordered})
    links = list(dict.fromkeys((ef.get(L["links"], "") or "").splitlines() + [c["url"] for c in ordered]))
    summary = (f"GitHub ghi nhận {len(ordered)} lượt cập nhật ngày {day}. {classify(ordered)}. "
               "Chỉ phản ánh lịch sử mã nguồn, không xác nhận kiểm thử, triển khai hoặc kết quả thí nghiệm.")
    if state.get("curated"):
        summary = ef.get(L["summary"], "").split(AUTO_MARK)[0] + AUTO_MARK + summary
    fields = {
        L["key"]: key_for(repo, day), L["date"]: iso(latest),
        L["source"]: "GitHub", L["sha"]: latest_event["sha"], L["url"]: latest_event["url"],
        L["raw"]: json.dumps(state, ensure_ascii=False, separators=(",", ":")),
        L["links"]: "\n".join(links), L["summary"]: summary,
    }
    if not existing:
        title = workstream["fields"][W["name"]]
        fields.update({L["title"]: f"Đồng bộ Git — {title} — {day}", L["name"]: title,
                       L["workstream"]: [workstream["id"]], L["type"]: "Tiến độ"})
    if not state.get("curated"):
        fields[L["done"]] = classify(ordered) + ". Chi tiết nguyên văn tại các liên kết và Dữ liệu Git gốc."
    if any(isinstance(value, str) and len(value) > MAX_TEXT for value in fields.values()):
        raise SyncError("Nhật ký vượt giới hạn an toàn; không cắt mất bằng chứng hoặc mã chống trùng")
    return fields


def scan_since(now: datetime, workstream: dict, lookback: int) -> datetime:
    since = now - timedelta(hours=lookback)
    previous = workstream.get("fields", {}).get(W["sync"])
    if previous:
        # Recover missed runs, plus an overlapping window for late commits.
        since = min(since, dt(previous) - timedelta(hours=36))
    return since


def sync_all(client: Client, config: dict, now: datetime, lookback: int, dry_run: bool = False) -> dict:
    zone = ZoneInfo(config.get("timezone", "Asia/Bangkok"))
    report = {"scan_started_at": iso(now), "dry_run": dry_run, "projects": [], "errors": []}
    workstreams = {r["id"]: r for r in client.records(config["workstreams_table"], list(W.values()))}
    rows = client.records(config["checklogs_table"], list(L.values()))
    for project in config["projects"]:
        repo = project["repo"]
        result = {"repo": repo, "status": "pending", "new_commits": 0, "written_logs": 0}
        report["projects"].append(result)
        try:
            if not re.fullmatch(r"[\w.-]+/[\w.-]+", repo):
                raise SyncError("Tên kho mã không hợp lệ")
            record = workstreams.get(project["workstream_id"])
            if not record or not record.get("fields", {}).get(W["name"]):
                raise SyncError("Không tìm thấy ID dự án/tên dự án; không bỏ qua như đồng bộ thành công")
            seen, daily = existing_state(rows, repo, record["id"])
            normalized = {c["sha"].lower(): normalize_commit(c) for c in client.commits(repo, scan_since(now, record, lookback), now)}
            groups = defaultdict(list)
            for event in normalized.values():
                if event["sha"] not in seen and not is_noise(event):
                    groups[dt(event["date"]).astimezone(zone).date().isoformat()].append(event)
            latest = max((dt(e["date"]).astimezone(zone).date().isoformat()
                          for e in normalized.values() if not is_noise(e)), default=None)
            for day, fresh in sorted(groups.items()):
                fields = plan_log(repo, record, day, fresh, daily.get(key_for(repo, day)))
                if not dry_run:
                    client.upsert_log(fields)
                    result["written_logs"] += 1
                result["new_commits"] += len(fresh)
                latest = max(latest or day, day)
            # Do not alter project status, focus, next action, percentage or deadlines.
            updates = {W["sync"]: iso(now)}
            if latest:
                updates[W["updated"]] = max(record.get("fields", {}).get(W["updated"], "")[:10], latest)
            if not dry_run:
                client.update_workstream(record["id"], updates)
            result["status"] = "dry_run" if dry_run else "ok"
        except (SyncError, KeyError, ValueError, TypeError) as exc:
            message = str(exc) if isinstance(exc, SyncError) else f"Dữ liệu/cấu hình không hợp lệ ({type(exc).__name__})"
            result.update(status="error", error=message)
            report["errors"].append({"repo": repo, "error": message})
            # Other repositories continue; this repository's sync timestamp is not advanced.
    return report


def write_report(report: dict) -> None:
    path = os.environ.get("SYNC_REPORT_PATH")
    if path:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write("## Kết quả đồng bộ R&D\n\n")
            for result in report.get("projects", []):
                stream.write(f"- `{result['repo']}`: **{result['status']}**, {result['new_commits']} commit mới, {result['written_logs']} nhật ký đã ghi.\n")
            for error in report.get("errors", []):
                stream.write(f"\nLỗi `{error.get('repo', 'khởi tạo')}`: {error['error']}\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("projects.json"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        token = os.environ.get("AIRTABLE_TOKEN", "").strip()
        if not token:
            raise SyncError("Thiếu AIRTABLE_TOKEN trong GitHub Actions Secrets; chưa thể đồng bộ tự động")
        config = json.loads(args.config.read_text(encoding="utf-8"))
        lookback = int(os.environ.get("LOOKBACK_HOURS", "36"))
        if not 1 <= lookback <= 24 * 365:
            raise SyncError("LOOKBACK_HOURS phải trong khoảng 1..8760")
        client = Client(config, token, os.environ.get("GH_SYNC_TOKEN") or os.environ.get("GITHUB_TOKEN", ""))
        report = sync_all(client, config, datetime.now(timezone.utc), lookback, args.dry_run)
    except (SyncError, ValueError, KeyError, TypeError, OSError) as exc:
        message = str(exc) if isinstance(exc, SyncError) else f"Không khởi tạo được ({type(exc).__name__}); kiểm tra cấu hình"
        report = {"projects": [], "errors": [{"error": message}]}
    write_report(report)
    return 2 if report["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())

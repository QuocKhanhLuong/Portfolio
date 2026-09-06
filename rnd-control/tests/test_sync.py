import copy
import importlib.util
import json
import os
import sys
import unittest
import urllib.error
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("rnd_sync", ROOT / "sync_airtable.py")
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
W, L = s.W, s.L
REPO = "test/example"
RID = "recExampleProject"
NOW = s.dt("2026-09-06T16:00:00Z")


def commit(n, when="2026-09-06T13:00:00Z", message="feat: something"):
    return {"sha": f"{n:040x}", "html_url": f"https://github.com/{REPO}/commit/{n:040x}",
            "commit": {"committer": {"date": when}, "message": message}}


def config():
    return {"base_id": "test", "workstreams_table": "ws", "checklogs_table": "logs",
            "timezone": "Asia/Bangkok", "projects": [{"repo": REPO, "workstream_id": RID}]}


class FakeClient:
    def __init__(self, commits=None):
        self.ws = [{"id": RID, "fields": {W["name"]: "Tên đã đổi", W["updated"]: "2026-09-01"}}]
        self.logs = []
        self.events = {REPO: commits or []}
        self.updated = []
        self.written = []
        self.fail_log = False
        self.fail_ws = False

    def records(self, table, _fields):
        return copy.deepcopy(self.ws if table == "ws" else self.logs)

    def commits(self, repo, since, until):
        value = self.events[repo]
        if isinstance(value, Exception):
            raise value
        return copy.deepcopy(value)

    def upsert_log(self, fields):
        if self.fail_log:
            raise s.SyncError("write failed")
        for row in self.logs:
            if row["fields"].get(L["key"]) == fields[L["key"]]:
                row["fields"].update(copy.deepcopy(fields))
                break
        else:
            self.logs.append({"id": f"recLog{len(self.logs)}", "fields": copy.deepcopy(fields)})
        self.written.append(copy.deepcopy(fields))

    def update_workstream(self, rid, fields):
        if self.fail_ws:
            raise s.SyncError("workstream write failed")
        row = next(r for r in self.ws if r["id"] == rid)
        row["fields"].update(copy.deepcopy(fields))
        self.updated.append((rid, copy.deepcopy(fields)))


class SyncTests(unittest.TestCase):
    def run_sync(self, client, cfg=None, dry=False):
        return s.sync_all(client, cfg or config(), NOW, 36, dry)

    def test_renaming_cannot_break_mapping(self):
        c = FakeClient([commit(1)])
        result = self.run_sync(c)
        self.assertFalse(result["errors"])
        self.assertEqual(c.logs[0]["fields"][L["name"]], "Tên đã đổi")
        self.assertTrue(all(key.startswith("fld") for key in c.written[0]))

    def test_complete_sha_dedup_more_than_24_commits(self):
        c = FakeClient([commit(i) for i in range(1, 102)])
        self.run_sync(c)
        self.assertEqual(len(s.raw_state(c.logs[0]["fields"])["commits"]), 101)
        count = len(c.written)
        self.run_sync(c)
        self.assertEqual(len(c.written), count)
        self.assertEqual(len(c.logs), 1)

    def test_new_commit_same_day_updates_one_log(self):
        c = FakeClient([commit(1)])
        self.run_sync(c)
        c.events[REPO].append(commit(2))
        self.run_sync(c)
        self.assertEqual(len(c.logs), 1)
        self.assertEqual(len(s.raw_state(c.logs[0]["fields"])["commits"]), 2)

    def test_bangkok_day_boundary(self):
        c = FakeClient([commit(1, "2026-09-05T18:00:00Z")])
        self.run_sync(c)
        self.assertEqual(c.logs[0]["fields"][L["key"]], "github:test/example:2026-09-06")

    def test_preserves_curated_notes(self):
        c = FakeClient([commit(1)])
        self.run_sync(c)
        fields = c.logs[0]["fields"]
        state = s.raw_state(fields)
        state["curated"] = True
        fields[L["raw"]] = json.dumps(state)
        fields[L["summary"]] = "Nhận định có bằng chứng của người dùng."
        fields[L["done"]] = "Nội dung đã xác nhận."
        fields["unrelated"] = "Quyết định giữ nguyên."
        c.events[REPO].append(commit(2))
        self.run_sync(c)
        self.assertTrue(fields[L["summary"]].startswith("Nhận định có bằng chứng"))
        self.assertEqual(fields[L["done"]], "Nội dung đã xác nhận.")
        self.assertEqual(fields["unrelated"], "Quyết định giữ nguyên.")

    def test_dates_never_move_backwards(self):
        c = FakeClient([commit(1, "2026-09-05T12:00:00Z")])
        c.ws[0]["fields"][W["updated"]] = "2026-09-06"
        self.run_sync(c)
        self.assertEqual(c.ws[0]["fields"][W["updated"]], "2026-09-06")
        normalized = s.normalize_commit(commit(2, "2026-09-05T10:00:00Z"))
        result = s.plan_log(REPO, c.ws[0], "2026-09-05", [normalized], c.logs[0])
        self.assertEqual(result[L["date"]], "2026-09-05T12:00:00Z")
        self.assertEqual(result[L["sha"]], f"{1:040x}")

    def test_empty_scan_only_updates_sync_time(self):
        c = FakeClient()
        self.run_sync(c)
        self.assertFalse(c.logs)
        self.assertEqual(c.ws[0]["fields"][W["updated"]], "2026-09-01")
        self.assertEqual(c.ws[0]["fields"][W["sync"]], s.iso(NOW))

    def test_no_noise_only_progress(self):
        c = FakeClient([commit(1, message="chore(rnd): setup"), commit(2, message="style: formatting")])
        self.run_sync(c)
        self.assertFalse(c.logs)

    def test_one_repository_error_does_not_stop_others(self):
        c = FakeClient([commit(1)])
        cfg = config()
        bad = {"repo": "test/private", "workstream_id": "recPrivate"}
        cfg["projects"].insert(0, bad)
        c.ws.append({"id": "recPrivate", "fields": {W["name"]: "Private"}})
        c.events["test/private"] = s.SyncError("HTTP 404")
        report = self.run_sync(c, cfg)
        self.assertEqual(len(report["errors"]), 1)
        self.assertEqual(report["projects"][1]["status"], "ok")
        self.assertNotIn(W["sync"], c.ws[1]["fields"])

    def test_failed_write_never_advances_watermark(self):
        c = FakeClient([commit(1)])
        c.fail_log = True
        self.assertTrue(self.run_sync(c)["errors"])
        self.assertFalse(c.updated)

    def test_recovers_workstream_after_partial_failure(self):
        c = FakeClient([commit(1)])
        c.fail_ws = True
        self.assertTrue(self.run_sync(c)["errors"])
        self.assertEqual(len(c.logs), 1)
        c.fail_ws = False
        self.run_sync(c)
        self.assertEqual(len(c.logs), 1)
        self.assertEqual(c.ws[0]["fields"][W["updated"]], "2026-09-06")

    def test_dry_run_has_no_writes(self):
        c = FakeClient([commit(1)])
        self.run_sync(c, dry=True)
        self.assertFalse(c.logs)
        self.assertFalse(c.updated)

    def test_legacy_source_dedup(self):
        c = FakeClient([commit(1)])
        c.logs.append({"id": "old", "fields": {L["source"]: "GitHub", L["workstream"]: [RID], L["sha"]: f"{1:040x}"}})
        self.run_sync(c)
        self.assertEqual(len(c.logs), 1)
        self.assertFalse(c.written)

    def test_invalid_raw_state_fails_loudly(self):
        with self.assertRaises(s.SyncError):
            s.raw_state({L["raw"]: "not-json"})

    def test_missed_schedule_catches_up(self):
        record = {"fields": {W["sync"]: s.iso(NOW - timedelta(days=5))}}
        self.assertLess(s.scan_since(NOW, record, 36), NOW - timedelta(days=5))

    def test_paginates_airtable_with_ids(self):
        client = s.Client(config(), "not-a-real-token")
        with patch.object(client, "at", side_effect=[{"records": [{"id": "one"}], "offset": "next"}, {"records": [{"id": "two"}]}]) as mocked:
            self.assertEqual(len(client.records("logs", [L["key"]])), 2)
            self.assertEqual(mocked.call_args.kwargs["query"]["offset"], "next")
            self.assertEqual(mocked.call_args.kwargs["query"]["returnFieldsByFieldId"], "true")

    def test_upsert_uses_fixed_key_and_no_typecast(self):
        client = s.Client(config(), "not-a-real-token")
        with patch.object(client, "at", return_value={}) as mocked:
            client.upsert_log({L["key"]: "github:test/example:2026-09-06"})
            body = mocked.call_args.kwargs["body"]
            self.assertEqual(body["performUpsert"]["fieldsToMergeOn"], [L["key"]])
            self.assertFalse(body["typecast"])

    def test_404_is_not_retried_or_disclosed(self):
        error = urllib.error.HTTPError("https://api.github.com", 404, "SECRET", {}, None)
        with patch.object(s.urllib.request, "urlopen", side_effect=error) as mocked:
            with self.assertRaises(s.SyncError) as caught:
                s.http_json("https://api.github.com/repos/test/private")
            self.assertEqual(mocked.call_count, 1)
            self.assertNotIn("SECRET", str(caught.exception))

    def test_rate_limit_retries(self):
        error = urllib.error.HTTPError("https://api.github.com", 429, "rate", {}, None)
        with patch.object(s.urllib.request, "urlopen", side_effect=error) as mocked, patch.object(s.time, "sleep"):
            with self.assertRaises(s.SyncError):
                s.http_json("https://api.github.com/repos/test/example")
            self.assertEqual(mocked.call_count, 4)

    def test_missing_secret_is_explicit_failure(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(sys, "argv", ["sync_airtable.py"]), patch.object(s, "write_report") as report:
            self.assertEqual(s.main(), 2)
            self.assertIn("AIRTABLE_TOKEN", report.call_args.args[0]["errors"][0]["error"])


if __name__ == "__main__":
    unittest.main()

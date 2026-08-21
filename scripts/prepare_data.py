"""Sanitize a Microsoft Forms charge-tracker export for GitHub Pages.

Anyone in the export is treated as completed. Emails, IDs, start times,
and SharePoint / file-upload URLs are stripped before publishing.
Duplicate names keep the latest completion time.
"""

from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WORKSPACE = REPO.parent
OUTPUT_JSON = REPO / "data" / "charges.json"
SOURCE_DIR = REPO / "source"

SKIP_EXACT = {
    "id",
    "start time",
    "email",
    "email address",
}
URL_RE = re.compile(r"https?://", re.IGNORECASE)
EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def parse_datetime(value: str | None) -> datetime:
    if not value:
        return datetime.min
    raw = value.strip()
    for fmt in (
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return datetime.min


def isoformat(value: datetime) -> str | None:
    if value is datetime.min:
        return None
    return value.strftime("%Y-%m-%dT%H:%M:%S")


def display_time(value: datetime) -> str:
    if value is datetime.min:
        return ""
    hour = value.strftime("%I").lstrip("0") or "0"
    return f"{value.strftime('%b')} {value.day}, {value.year} {hour}:{value.strftime('%M %p')}"


def is_pii_column(name: str) -> bool:
    lowered = name.strip().casefold()
    if lowered in SKIP_EXACT:
        return True
    if "email" in lowered:
        return True
    if "upload" in lowered or "screenshot" in lowered or "file" in lowered:
        return True
    return False


def looks_like_pii_value(value: str) -> bool:
    return bool(URL_RE.search(value) or EMAIL_RE.search(value))


def find_source_csv() -> Path | None:
    named = (
        list(SOURCE_DIR.glob("*.csv"))
        + list(WORKSPACE.glob("*charge*.csv"))
        + list(WORKSPACE.glob("*Charge*.csv"))
    )
    usable = [
        path
        for path in named
        if path.is_file() and "step tracker" not in path.name.casefold()
    ]
    if usable:
        return max(usable, key=lambda path: path.stat().st_mtime)
    return None


def read_csv(path: Path) -> list[dict[str, str]]:
    text = None
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            text = path.read_text(encoding=encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise UnicodeDecodeError("utf-8", b"", 0, 1, f"Could not decode {path}")
    return list(csv.DictReader(StringIO(text)))


def pick_name(row: dict[str, str]) -> str:
    for key in row:
        if key.strip().casefold() == "name":
            return (row.get(key) or "").strip()
    return ""


def pick_completed_at(row: dict[str, str]) -> str:
    for key in row:
        if key.strip().casefold() == "completion time":
            return (row.get(key) or "").strip()
    return ""


def extra_answers(row: dict[str, str]) -> dict[str, str]:
    answers: dict[str, str] = {}
    for key, raw in row.items():
        if not key or is_pii_column(key) or key.strip().casefold() in {"name", "completion time"}:
            continue
        value = (raw or "").strip()
        if not value or looks_like_pii_value(value):
            continue
        answers[key.strip()] = value
    return answers


def empty_payload(source: str, note: str) -> dict:
    return {
        "meta": {
            "title": "Charge tracker",
            "subtitle": "Form completion board",
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": source,
            "privacy": "Emails and file-upload links were removed before publishing.",
            "note": note,
        },
        "kpis": {
            "completed": 0,
            "latestAt": None,
            "latestLabel": "",
        },
        "byDay": [],
        "people": [],
    }


def main() -> None:
    source = find_source_csv()
    if source is None:
        payload = empty_payload(
            "No Microsoft Forms CSV found",
            "Drop a Forms export CSV into source/ or AI Workspace (*charge*.csv), then rerun this script.",
        )
        OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"No CSV found. Wrote empty board to {OUTPUT_JSON}")
        return

    best: dict[str, dict] = {}
    for row in read_csv(source):
        name = pick_name(row)
        if not name:
            continue
        completed_at_raw = pick_completed_at(row)
        completed_at = parse_datetime(completed_at_raw)
        record = {
            "name": name,
            "completed": True,
            "completedAt": isoformat(completed_at),
            "completedLabel": display_time(completed_at),
            "answers": extra_answers(row),
        }
        key = name.casefold()
        previous = best.get(key)
        if previous is None:
            best[key] = record
            continue
        prev_iso = previous.get("completedAt")
        prev_dt = (
            datetime.strptime(prev_iso, "%Y-%m-%dT%H:%M:%S") if prev_iso else datetime.min
        )
        if completed_at >= prev_dt:
            best[key] = record

    people = sorted(
        best.values(),
        key=lambda item: (item["completedAt"] or "", item["name"].casefold()),
        reverse=True,
    )

    day_counts: dict[str, int] = {}
    latest: datetime | None = None
    for person in people:
        if not person["completedAt"]:
            continue
        day = person["completedAt"][:10]
        day_counts[day] = day_counts.get(day, 0) + 1
        stamp = datetime.strptime(person["completedAt"], "%Y-%m-%dT%H:%M:%S")
        if latest is None or stamp > latest:
            latest = stamp

    by_day = [
        {"day": day, "count": day_counts[day]}
        for day in sorted(day_counts)
    ]

    payload = {
        "meta": {
            "title": "Charge tracker",
            "subtitle": "Form completion board",
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": source.name,
            "privacy": "Emails and file-upload links were removed before publishing.",
            "note": "Anyone in the Forms export is marked completed. Duplicate names keep the latest response.",
        },
        "kpis": {
            "completed": len(people),
            "latestAt": isoformat(latest) if latest else None,
            "latestLabel": display_time(latest) if latest else "",
        },
        "byDay": by_day,
        "people": people,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_JSON}")
    print(f"{len(people)} completed from {source.name}")


if __name__ == "__main__":
    main()

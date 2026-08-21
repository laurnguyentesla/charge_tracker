"""Sanitize a Microsoft Forms export for GitHub Pages.

Anyone in the export is treated as completed. Emails, IDs, start times,
questionnaire answers, and SharePoint / file-upload URLs are stripped
before publishing. Duplicate names keep the latest completion time.
"""

from __future__ import annotations

import csv
import json
import shutil
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WORKSPACE = REPO.parent
DOWNLOADS = Path.home() / "Downloads"
OUTPUT_JSON = REPO / "data" / "charges.json"
SOURCE_DIR = REPO / "source"

SKIP_NAMES = {"step tracker"}


def parse_datetime(value: object) -> datetime:
    if value is None or value == "":
        return datetime.min
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    raw = str(value).strip()
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


def isoformat(value: datetime | None) -> str | None:
    if value is None or value is datetime.min:
        return None
    return value.strftime("%Y-%m-%dT%H:%M:%S")


def display_time(value: datetime | None) -> str:
    if value is None or value is datetime.min:
        return ""
    hour = value.strftime("%I").lstrip("0") or "0"
    return f"{value.strftime('%b')} {value.day}, {value.year} {hour}:{value.strftime('%M %p')}"


def cell_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%m/%d/%Y %H:%M:%S")
    return str(value).replace("\xa0", " ").strip()


def is_usable(path: Path) -> bool:
    if not path.is_file():
        return False
    lowered = path.name.casefold()
    return not any(skip in lowered for skip in SKIP_NAMES)


def find_source() -> Path | None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    downloads = sorted(
        DOWNLOADS.glob("Employee Spotlight Questionnaire*.xlsx"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if downloads:
        dest = SOURCE_DIR / "employee-spotlight.xlsx"
        shutil.copy2(downloads[0], dest)
        return dest

    named = (
        list(SOURCE_DIR.glob("*.xlsx"))
        + list(SOURCE_DIR.glob("*.csv"))
        + list(WORKSPACE.glob("*spotlight*.xlsx"))
        + list(WORKSPACE.glob("*newsletter*.xlsx"))
        + list(WORKSPACE.glob("*charge*.csv"))
        + list(WORKSPACE.glob("*Charge*.csv"))
    )
    usable = [path for path in named if is_usable(path)]
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
    return [{key: cell_text(value) for key, value in row.items()} for row in csv.DictReader(StringIO(text))]


def read_xlsx(path: Path) -> list[dict[str, str]]:
    from openpyxl import load_workbook

    workbook = load_workbook(path, data_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [cell_text(value) or f"column_{index}" for index, value in enumerate(rows[0])]
    records: list[dict[str, str]] = []
    for row in rows[1:]:
        record = {}
        for index, header in enumerate(headers):
            record[header] = cell_text(row[index] if index < len(row) else None)
        records.append(record)
    return records


def read_rows(path: Path) -> list[dict[str, str]]:
    if path.suffix.casefold() in {".xlsx", ".xlsm"}:
        return read_xlsx(path)
    return read_csv(path)


def pick_field(row: dict[str, str], *names: str) -> str:
    wanted = {name.casefold() for name in names}
    for key, value in row.items():
        if key.strip().casefold() in wanted:
            return (value or "").strip()
    return ""


def empty_payload(source: str, note: str) -> dict:
    return {
        "meta": {
            "title": "Employee Spotlight",
            "subtitle": "Newsletter questionnaire",
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": source,
            "privacy": "Emails and written answers were removed before publishing.",
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
    source = find_source()
    if source is None:
        payload = empty_payload(
            "No Microsoft Forms export found",
            "Drop the Forms Excel/CSV into source/ or Downloads, then rerun this script.",
        )
        OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"No export found. Wrote empty board to {OUTPUT_JSON}")
        return

    best: dict[str, dict] = {}
    for row in read_rows(source):
        name = pick_field(row, "name")
        if not name:
            continue
        completed_at = parse_datetime(pick_field(row, "completion time"))
        record = {
            "name": name,
            "completed": True,
            "completedAt": isoformat(completed_at),
            "completedLabel": display_time(completed_at),
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

    payload = {
        "meta": {
            "title": "Employee Spotlight",
            "subtitle": "Newsletter questionnaire",
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "Employee Spotlight Questionnaire",
            "privacy": "Emails and written answers were removed before publishing.",
            "note": "Anyone in the Forms export is marked completed. Duplicate names keep the latest response.",
        },
        "kpis": {
            "completed": len(people),
            "latestAt": isoformat(latest) if latest else None,
            "latestLabel": display_time(latest) if latest else "",
        },
        "byDay": [{"day": day, "count": day_counts[day]} for day in sorted(day_counts)],
        "people": people,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_JSON}")
    print(f"{len(people)} completed from {source.name}")
    for person in people:
        print(f"  {person['name']} — completed {person['completedLabel']}")


if __name__ == "__main__":
    main()

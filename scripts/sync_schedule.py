"""Download the public group schedule without browser CORS or Supabase credentials."""

import datetime as dt
import json
import pathlib
import sys
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

GROUP = "25290909/3091"
SOURCE = "https://polytech-schedule.ru"
OUTPUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "schedule.json"


def validate_days(days, start, end):
    """Reject partial, malformed, foreign-group and unknown-status responses."""
    if not isinstance(days, dict) or not days:
        raise ValueError("Source returned no schedule; keeping the previous snapshot")
    for date, day in days.items():
        parsed = dt.date.fromisoformat(date)
        if not start <= parsed <= end or not isinstance(day, dict):
            raise ValueError(f"Invalid day: {date}")
        if not isinstance(day.get("lessons"), list):
            raise ValueError(f"Missing lessons: {date}")
        for lesson in day["lessons"]:
            if (type(lesson.get("lesson_number")) is not int
                    or not 1 <= lesson["lesson_number"] <= 10
                    or not isinstance(lesson.get("subject"), str)
                    or not lesson["subject"].strip()
                    or lesson.get("status") not in ("ok", "replacement", "cancellation")
                    or lesson.get("subgroup") not in (0, 1, 2)):
                raise ValueError(f"Invalid lesson: {date}")
            if GROUP not in lesson.get("group_list", []):
                raise ValueError(f"Unexpected group: {date}")
    if not any(day["lessons"] for day in days.values()):
        raise ValueError("Empty response; keeping the previous snapshot")


def build_snapshot(response, previous, today):
    """Replace a complete fetched interval, retain history, and record explicit free days."""
    monday = today - dt.timedelta(days=today.weekday())
    start, end = monday - dt.timedelta(days=7), monday + dt.timedelta(days=34)
    days = response.get("days")
    validate_days(days, start, end)
    end = dt.date.fromisoformat(max(days))
    history = previous.get("days", {}) if previous.get("group") == GROUP else {}
    keep_after = today - dt.timedelta(weeks=40)
    merged = {date: day for date, day in history.items() if keep_after.isoformat() <= date < start.isoformat()}
    for offset in range((end - start).days + 1):
        date = (start + dt.timedelta(days=offset)).isoformat()
        merged[date] = days.get(date, {"lessons": []})
    return {
        "schema": 1,
        "group": GROUP,
        "source": SOURCE,
        "checked_at": today.isoformat(),
        "from": min(merged),
        "to": end.isoformat(),
        "days": dict(sorted(merged.items())),
    }


def main():
    """Fetch over verified HTTPS and atomically replace the validated feed."""
    today = dt.datetime.now(ZoneInfo("Europe/Moscow")).date()
    monday = today - dt.timedelta(days=today.weekday())
    params = urllib.parse.urlencode({
        "start_date": (monday - dt.timedelta(days=7)).isoformat(),
        "end_date": (monday + dt.timedelta(days=34)).isoformat(),
        "group": GROUP,
    })
    request = urllib.request.Request(SOURCE + "/api/schedule/range?" + params,
                                     headers={"Accept": "application/json", "User-Agent": "Politeshik-schedule-sync/1.0"})
    with urllib.request.urlopen(request, timeout=40) as response:
        payload = json.load(response)
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    snapshot = build_snapshot(payload, previous, today)
    content = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    if OUTPUT.exists() and OUTPUT.read_text() == content:
        print("Schedule unchanged")
        return
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUTPUT.with_suffix(".tmp")
    temp.write_text(content, encoding="utf-8")
    temp.replace(OUTPUT)
    print(f"Saved {len(snapshot['days'])} days for {GROUP}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Schedule sync failed: {error}", file=sys.stderr)
        sys.exit(1)

"""Fetch the exact teacher's public timetable without exposing any app credentials."""
import datetime as dt
import json
import pathlib
import re
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

TEACHER = "Назаров Д.А."
FULL_NAME = "Назаров Денис Александрович"
SOURCE = "https://polytech-schedule.ru"
OUTPUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "schedule-teacher-nazarov-da.json"


def teacher_key(value):
    return re.sub(r"[\s.]", "", str(value)).casefold().replace("ё", "е")


def build_snapshot(response, previous, today, teacher=TEACHER, full_name=FULL_NAME):
    monday = today - dt.timedelta(days=today.weekday())
    start, requested_end = monday - dt.timedelta(days=7), monday + dt.timedelta(days=34)
    days = response.get("days")
    if not isinstance(days, dict) or not days:
        raise ValueError("Teacher timetable is empty; preserving the last valid copy")
    for date, day in days.items():
        if not start <= dt.date.fromisoformat(date) <= requested_end or not isinstance(day, dict) or not isinstance(day.get("lessons"), list):
            raise ValueError("Invalid teacher schedule day")
        for lesson in day["lessons"]:
            belongs = teacher_key(lesson.get("teacher")) == teacher_key(teacher)
            changed = lesson.get("status") in ("replacement", "cancellation") and teacher_key(lesson.get("original_teacher")) == teacher_key(teacher)
            if not (belongs or changed):
                raise ValueError("Namesake or unrelated teacher in timetable")
            if type(lesson.get("lesson_number")) is not int or not 0 <= lesson["lesson_number"] <= 10 or not lesson.get("subject") or lesson.get("status") not in ("ok", "replacement", "cancellation"):
                raise ValueError("Invalid teacher lesson")
            groups = lesson.get("group_list")
            if not isinstance(groups, list) or not groups or not all(re.fullmatch(r"[зЗ]?\d{8}/\d{4}", str(group)) for group in groups):
                raise ValueError("Missing group for teacher lesson")
    if not any(day["lessons"] for day in days.values()):
        raise ValueError("No teacher lessons; preserving the last valid copy")
    history = previous.get("days", {}) if previous.get("teacher") == teacher else {}
    merged = {date: day for date, day in history.items() if (today - dt.timedelta(weeks=40)).isoformat() <= date < start.isoformat()}
    end = dt.date.fromisoformat(max(days))
    published_start = dt.date.fromisoformat(min(days))
    for offset in range((end - published_start).days + 1):
        date = (published_start + dt.timedelta(days=offset)).isoformat()
        merged[date] = days.get(date, {"lessons": []})
    return {"schema": 1, "kind": "teacher", "teacher": teacher, "full_name": full_name, "source": SOURCE, "checked_at": today.isoformat(), "from": min(merged), "to": end.isoformat(), "days": dict(sorted(merged.items()))}


def main():
    today = dt.datetime.now(ZoneInfo("Europe/Moscow")).date()
    monday = today - dt.timedelta(days=today.weekday())
    params = urllib.parse.urlencode({"start_date": (monday - dt.timedelta(days=7)).isoformat(), "end_date": (monday + dt.timedelta(days=34)).isoformat(), "teacher": TEACHER})
    request = urllib.request.Request(SOURCE + "/api/schedule/range?" + params, headers={"Accept": "application/json", "User-Agent": "Politeshik-teacher-sync/1.0"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = json.load(response)
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    snapshot = build_snapshot(data, previous, today)
    content = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    if OUTPUT.exists() and OUTPUT.read_text() == content:
        print(f"Teacher schedule unchanged for {TEACHER}")
        return
    temp = OUTPUT.with_suffix(".tmp")
    temp.write_text(content, encoding="utf-8")
    temp.replace(OUTPUT)
    print(f"Saved {sum(len(day['lessons']) for day in snapshot['days'].values())} lessons for {TEACHER}")


if __name__ == "__main__":
    main()

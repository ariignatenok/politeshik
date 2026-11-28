"""Read the dated fortnightly XML files published by the timetable site."""

import datetime as dt
import functools
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

SOURCE = "https://polytech-shedule.ru"


def teacher_key(value):
    return re.sub(r"[\s.]", "", str(value)).casefold().replace("ё", "е")


def classroom(row):
    room = row.findtext("AUD", "").strip()
    campus = row.findtext("CAMPUS", "").strip()
    return f"{room} ({campus})" if room and campus else room


def parse_period(xml):
    root = ET.fromstring(xml)
    rows = root.findall("My")
    if root.tag != "dataroot" or not rows:
        raise ValueError("Published XML has no schedule rows")

    by_lesson = {}
    dates = set()
    for row in rows:
        date = dt.datetime.fromisoformat(row.findtext("DAT")).date()
        dates.add(date)
        number = int(row.findtext("UR"))
        subgroup = int(row.findtext("IDGG"))
        group = row.findtext("SPGRUP.NAIM", "").strip()
        key = (date, number, subgroup, group, row.findtext("ID"))
        version = row.findtext("ZAM")
        if version not in {"0", "1", "2"}:
            raise ValueError(f"Unknown timetable status: {version}")
        versions = by_lesson.setdefault(key, {})
        if version in versions:
            raise ValueError(f"Duplicate timetable row: {key}")
        versions[version] = row

    lessons = []
    for (date, number, subgroup, group, _), versions in by_lesson.items():
        row = versions.get("1", versions.get("0"))
        if row is None:
            raise ValueError("Original timetable row has no replacement")
        subject = row.findtext("SPPRED.NAIM", "").strip()
        status = "ok"
        if "1" in versions:
            status = "cancellation" if subject.casefold() == "отмена" else "replacement"
        lesson = {
            "lesson_number": number, "subgroup": subgroup, "group_list": [group],
            "subject": subject, "status": status, "teacher": row.findtext("FAMIO", "").strip(),
            "classroom": classroom(row), "note": row.findtext("NOTE", "").strip(),
        }
        if "2" in versions:
            original = versions["2"]
            lesson.update(
                original_subject=original.findtext("SPPRED.NAIM", "").strip(),
                original_teacher=original.findtext("FAMIO", "").strip(),
                original_classroom=classroom(original),
            )
        lessons.append((date, lesson))
    return min(dates), max(dates), lessons


@functools.lru_cache(maxsize=8)
def published_period(academic_year, period):
    request = urllib.request.Request(
        f"{SOURCE}/data/{period}.xml", headers={"User-Agent": "Politeshik-schedule-sync/1.0"}
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            result = parse_period(response.read())
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise
    if result[0] < dt.date(academic_year, 9, 1) or result[1] >= dt.date(academic_year + 1, 9, 1):
        return None
    return result


def timetable(today, *, group=None, teacher=None):
    """Convert published dates to the snapshot schema used by the app."""
    monday = today - dt.timedelta(days=today.weekday())
    academic_year = today.year if today.month >= 9 else today.year - 1
    term_start = dt.date(academic_year, 9, 1)
    start, end = max(term_start, monday - dt.timedelta(days=7)), monday + dt.timedelta(days=34)
    first = (start - term_start).days // 14 + 1
    last = min(20, (end - term_start).days // 14 + 1)
    days = {}
    for period in range(first, last + 1):
        published = published_period(academic_year, period)
        if published is None:
            if days:
                break
            continue
        first_date, last_date, lessons = published
        first_day = max(start, first_date)
        last_day = min(end, last_date)
        for offset in range((last_day - first_day).days + 1):
            date = (first_day + dt.timedelta(days=offset)).isoformat()
            days.setdefault(date, {"lessons": []})
        for date, lesson in lessons:
            if not start <= date <= end:
                continue
            if group is not None:
                matches = group in lesson["group_list"] and lesson["lesson_number"] > 0
            else:
                matches = any(teacher_key(lesson.get(key)) == teacher_key(teacher)
                              for key in ("teacher", "original_teacher"))
            if matches:
                days[date.isoformat()]["lessons"].append(lesson)
    for day in days.values():
        day["lessons"].sort(key=lambda lesson: (lesson["lesson_number"], lesson["subgroup"], lesson["group_list"]))
    return {"days": days, "published_xml": True}

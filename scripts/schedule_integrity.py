"""Treat the external timetable as untrusted academic data, including saved history."""
import re
import json
import pathlib
import unicodedata

UNSAFE = re.compile(r'(?:^|[^а-яa-z])(?:ху[йея]|хует|пизд|бляд|говн|дерьм|залуп|дроч|шизофреник)|со своим ведром|практическими пытками|мочи строгого', re.I)
QUARANTINE=set(json.loads((pathlib.Path(__file__).resolve().parents[1]/'data/schedule-quarantine.json').read_text())['entities'])

def subject_id(value):
    key=re.sub(r'[_\s]+',' ',str(value or '').lower().replace('ё','е')).strip();number=2166136261
    for char in key:number=((number^ord(char))*16777619)&0xffffffff
    return 'polytech_'+format(number,'x')

FIELDS = ('subject', 'teacher', 'classroom', 'auditorium', 'note', 'original_subject', 'original_teacher', 'original_classroom')


def safe_text(value):
    text = unicodedata.normalize('NFKC', str(value or '')).casefold().replace('ё', 'е')
    text = re.sub('[\u200b-\u200f\ufeff]', '', text)
    return not UNSAFE.search(text) and subject_id(text) not in QUARANTINE


def safe_lesson(lesson):
    return isinstance(lesson, dict) and all(safe_text(lesson.get(key)) for key in FIELDS)


def validate_content(days, previous=None):
    lessons = [lesson for day in days.values() if isinstance(day, dict) for lesson in day.get('lessons', [])]
    if not all(safe_lesson(lesson) for lesson in lessons):
        raise ValueError('Schedule integrity alert: suspicious academic text; previous trusted snapshot retained')
    old = {str(l.get('subject', '')).strip().casefold() for d in (previous or {}).get('days', {}).values()
           for l in d.get('lessons', []) if safe_lesson(l)}
    new = {str(l.get('subject', '')).strip().casefold() for l in lessons}
    if old and len(new - old) >= 10 and len(new - old) > len(new) * .5:
        raise ValueError('Schedule integrity alert: mass subject replacement requires review')


def trusted_history(days):
    return {date: day for date, day in days.items()
            if isinstance(day, dict) and isinstance(day.get('lessons'), list)
            and all(safe_lesson(l) for l in day['lessons'])}

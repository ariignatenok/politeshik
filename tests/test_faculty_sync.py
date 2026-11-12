import importlib.util
import json
import pathlib
import sys
import unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import sync_faculty
from sync_teacher_schedule import build_snapshot
import datetime as dt

class FacultySyncTests(unittest.TestCase):
 def test_directory_has_all_unique_names_and_exact_keys(self):
  names=json.loads((ROOT/'data/faculty-names.json').read_text())
  directory=json.loads((ROOT/'data/faculty.json').read_text())
  self.assertEqual(len(names),187)
  self.assertEqual(set(names),{t['name'] for t in directory['teachers']})
  self.assertEqual(directory['unresolved'],[])
  self.assertEqual(len({t['id'] for t in directory['teachers']}),187)
  for teacher in directory['teachers']:
   self.assertEqual(sync_faculty.teacher_key(teacher['teacher']),sync_faculty.teacher_key(sync_faculty.identity(teacher['name'])['teacher']))
   if teacher['schedule_file']:
    snapshot=json.loads((ROOT/'data'/teacher['schedule_file']).read_text())
    self.assertEqual(snapshot['full_name'],teacher['name'])
    for day in snapshot['days'].values():
     for lesson in day['lessons']:
      self.assertTrue(sync_faculty.teacher_key(lesson.get('teacher'))==sync_faculty.teacher_key(teacher['teacher']) or lesson['status'] in ('replacement','cancellation') and sync_faculty.teacher_key(lesson.get('original_teacher'))==sync_faculty.teacher_key(teacher['teacher']))
 def test_zero_pair_and_parttime_group_are_preserved_without_renaming(self):
  lesson={'lesson_number':0,'subject':'Лабораторная','teacher':'Назаров Д.А.','status':'ok','group_list':['з25290909/3111']}
  result=build_snapshot({'days':{'2026-11-12':{'lessons':[lesson]}}},{},dt.date(2026,11,12))
  self.assertEqual(result['days']['2026-11-12']['lessons'][0],lesson)

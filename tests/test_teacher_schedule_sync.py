import copy
import datetime as dt
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('teacher_sync', pathlib.Path(__file__).resolve().parents[1] / 'scripts/sync_teacher_schedule.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class TeacherSyncTest(unittest.TestCase):
    def setUp(self):
        self.today = dt.date(2026, 11, 12)
        self.response = {'days': {'2026-11-09': {'lessons': [{'lesson_number': 2, 'teacher': 'Назаров Д.А.', 'subject': 'Психология общения', 'group_list': ['24290907/2092'], 'status': 'ok'}]}, '2026-11-12': {'lessons': []}}}

    def test_exact_teacher_and_only_reported_interval(self):
        snapshot = sync.build_snapshot(self.response, {}, self.today)
        self.assertEqual(snapshot['teacher'], 'Назаров Д.А.')
        self.assertEqual(snapshot['from'], '2026-11-09')
        self.assertEqual(snapshot['to'], '2026-11-12')
        self.assertEqual(snapshot['days']['2026-11-10']['lessons'], [])

    def test_namesake_is_rejected(self):
        self.response['days']['2026-11-09']['lessons'][0]['teacher'] = 'Назаров С.Ю.'
        with self.assertRaisesRegex(ValueError, 'Namesake'):
            sync.build_snapshot(self.response, {}, self.today)

    def test_empty_source_does_not_replace_saved_timetable(self):
        previous = sync.build_snapshot(self.response, {}, self.today)
        original = copy.deepcopy(previous)
        with self.assertRaises(ValueError):
            sync.build_snapshot({'days': {}}, previous, self.today)
        self.assertEqual(previous, original)

    def test_other_group_is_allowed_in_personal_teaching_schedule(self):
        self.response['days']['2026-11-09']['lessons'][0]['group_list'] = ['24290907/1095']
        snapshot = sync.build_snapshot(self.response, {}, self.today)
        self.assertEqual(snapshot['days']['2026-11-09']['lessons'][0]['group_list'], ['24290907/1095'])

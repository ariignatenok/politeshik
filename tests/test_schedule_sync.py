"""Exercise replacement, source failure and unpublished-date boundaries."""

import copy
import datetime as dt
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("sync", pathlib.Path(__file__).resolve().parents[1] / "scripts/sync_schedule.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class ScheduleSyncTest(unittest.TestCase):
    def setUp(self):
        self.lesson = {"lesson_number": 1, "subject": "ОПБД", "status": "ok", "subgroup": 0, "group_list": [sync.GROUP]}
        self.today = dt.date(2026, 11, 10)

    def response(self):
        return {"days": {"2026-11-09": {"lessons": [self.lesson]}, "2026-11-11": {"lessons": [self.lesson]}}}

    def test_missing_day_clears_old_lesson_but_unpublished_future_is_not_empty(self):
        previous = {"group": sync.GROUP, "days": {"2026-10-20": {"lessons": [self.lesson]}, "2026-11-10": {"lessons": [self.lesson]}}}
        result = sync.build_snapshot(self.response(), previous, self.today)
        self.assertEqual(result["days"]["2026-11-10"]["lessons"], [])
        self.assertIn("2026-10-20", result["days"])
        self.assertNotIn("2026-11-12", result["days"])
        self.assertEqual(result["to"], "2026-11-11")

    def test_bad_source_is_rejected(self):
        for field, value in [("status", "unknown"), ("group_list", ["another group"]), ("lesson_number", -1), ("subgroup", 7)]:
            with self.subTest(field=field):
                payload = copy.deepcopy(self.response())
                payload["days"]["2026-11-09"]["lessons"][0][field] = value
                with self.assertRaises(ValueError):
                    sync.build_snapshot(payload, {}, self.today)
        for payload in [{}, {"days": {}}, {"days": {"2026-11-09": {"lessons": []}}}]:
            with self.assertRaises(ValueError):
                sync.build_snapshot(payload, {}, self.today)

    def test_status_and_subgroup_survive(self):
        self.lesson.update(status="cancellation", subgroup=2)
        result = sync.build_snapshot(self.response(), {}, self.today)
        self.assertEqual(result["days"]["2026-11-09"]["lessons"][0]["status"], "cancellation")
        self.assertEqual(result["days"]["2026-11-09"]["lessons"][0]["subgroup"], 2)

    def test_second_group_is_parameterized_and_foreign_lessons_are_rejected(self):
        group = "26290911/3111"
        with self.assertRaises(ValueError):
            sync.build_snapshot(self.response(), {}, self.today, group)
        self.lesson["group_list"] = [group]
        result = sync.build_snapshot(self.response(), {}, self.today, group)
        self.assertEqual(result["group"], group)


if __name__ == "__main__":
    unittest.main()

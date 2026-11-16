import copy
import datetime as dt
import pathlib
import sys
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from schedule_integrity import safe_text, validate_content
from sync_schedule import build_snapshot, GROUP

class IntegrityTest(unittest.TestCase):
    def response(self):
        return {'days':{'2026-11-16':{'lessons':[{'subject':'ОПБД','teacher':'Васильев С.Ю.','lesson_number':1,'status':'ok','subgroup':0,'group_list':[GROUP]}]}}}
    def test_poisoned_subject_and_note_do_not_replace_last_good_snapshot(self):
        for field,text in [('subject','МДК лютого шлака с практическими пытками'),('note','Приходить со своим ведром'),('teacher','Шизофреников М.М.')]:
            data=self.response();data['days']['2026-11-16']['lessons'][0][field]=text
            with self.assertRaises(ValueError):build_snapshot(data,{},dt.date(2026,11,16))
    def test_unicode_obfuscation_is_rejected_and_real_names_are_not(self):
        self.assertFalse(safe_text('ху\u200bйня'))
        self.assertTrue(safe_text('Основы проектирования баз данных · Назаров Д.А.'))
    def test_mass_unknown_subject_change_is_quarantined(self):
        previous=self.response();new={'2026-11-16':{'lessons':[{'subject':'Выдуманный предмет '+str(i)}for i in range(12)]}}
        with self.assertRaises(ValueError):validate_content(new,previous)
    def test_poisoned_historical_day_is_not_retained(self):
        previous={'group':GROUP,'days':{'2026-10-20':{'lessons':[{'subject':'ху\u200bйня'}]}}}
        result=build_snapshot(self.response(),previous,dt.date(2026,11,16))
        self.assertNotIn('2026-10-20',result['days'])

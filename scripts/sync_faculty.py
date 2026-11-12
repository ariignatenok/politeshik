"""Exact faculty identity matching and public timetables; no credentials or Auth users."""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request
import time
import sys
from zoneinfo import ZoneInfo
from sync_teacher_schedule import build_snapshot, teacher_key, SOURCE

ROOT = pathlib.Path(__file__).resolve().parents[1]
GROUP_FILES = {'25290909/3091':'schedule.json','26290911/3111':'schedule-26290911-3111.json','23290907/2092':'schedule-23290907-2092.json','24290907/2092':'schedule-24290907-2092.json','25290907/3111':'schedule-25290907-3111.json','25290907/1091':'schedule-25290907-1091.json'}

def identity(name):
    parts = name.split()
    return {'id':'faculty-'+hashlib.sha256(name.encode()).hexdigest()[:12], 'name':name, 'teacher':name if name=='Мукбиль Мансур Хассан Мухаммад' else parts[0]+' '+''.join(p[0]+'.' for p in parts[1:])}

def request(path, params):
    req = urllib.request.Request(SOURCE+path+'?'+urllib.parse.urlencode(params),headers={'Accept':'application/json','User-Agent':'Politeshik-faculty-sync/1.0'})
    time.sleep(1)
    with urllib.request.urlopen(req,timeout=12) as r:
        return json.load(r)

def fetch_teacher(record, today):
    result = dict(record)
    result['attempted_at']=dt.datetime.now(dt.timezone.utc).isoformat()
    file = 'schedule-teacher-'+record['id']+'.json'
    path = ROOT/'data'/file
    previous = json.loads(path.read_text()) if path.exists() else {}
    try:
        if '--resume' in sys.argv and previous.get('checked_at')==today.isoformat():
            result.update(status='ready',schedule_file=file)
            return result
        monday=today-dt.timedelta(days=today.weekday())
        raw=request('/api/schedule/range',{'start_date':(monday-dt.timedelta(days=7)).isoformat(),'end_date':(monday+dt.timedelta(days=34)).isoformat(),'teacher':result['teacher']})
        if not raw.get('days') or not any(d.get('lessons') for d in raw['days'].values()):
            result.update(status='awaiting_source',schedule_file=file if previous else None,fetched_at=dt.datetime.now(dt.timezone.utc).isoformat())
            return result
        snapshot=build_snapshot(raw,previous,today,result['teacher'],record['name'])
        content=json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n'
        if not path.exists() or path.read_text()!=content:
            tmp=path.with_suffix('.tmp');tmp.write_text(content);tmp.replace(path)
        result.update(status='ready',schedule_file=file,fetched_at=dt.datetime.now(dt.timezone.utc).isoformat())
    except Exception as error:
        result.update(status='stale' if previous else 'source_error',schedule_file=file if previous else None)
        print(record['name']+': '+str(error),flush=True)
    return result

def assignments(records):
    """Use exact full initials; never infer an identity from surname alone."""
    by_key={}
    for record in records:
        by_key.setdefault(teacher_key(record['teacher']),[]).append(record)
        record['groups']={}
    unresolved=set()
    def add(teacher,group,subject):
        matches=by_key.get(teacher_key(teacher),[])
        if len(matches)!=1:
            if teacher:unresolved.add(teacher)
            return
        if group not in GROUP_FILES:return
        subjects=matches[0]['groups'].setdefault(group,[])
        if subject not in subjects:subjects.append(subject)
    for group,file in GROUP_FILES.items():
        data=json.loads((ROOT/'data'/file).read_text())
        for day in data['days'].values():
            for lesson in day['lessons']:
                if lesson.get('status')!='cancellation':add(lesson.get('teacher'),group,lesson['subject'])
    for record in records:
        file=record.get('schedule_file')
        if not file:continue
        for day in json.loads((ROOT/'data'/file).read_text())['days'].values():
            for lesson in day['lessons']:
                if lesson.get('status')!='cancellation' and teacher_key(lesson.get('teacher'))==teacher_key(record['teacher']):
                    for group in lesson.get('group_list',[]):add(record['teacher'],group,lesson['subject'])
    for record in records:
        record['groups']={g:sorted(v) for g,v in sorted(record['groups'].items())}
    return sorted(unresolved)

def choose_batch(records, size):
    return sorted(records,key=lambda r:r.get('attempted_at',''))[:size]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--batch-size',type=int,default=24)
    parser.add_argument('--all',action='store_true')
    parser.add_argument('--resume',action='store_true')
    args=parser.parse_args()
    if not 1<=args.batch_size<=187:parser.error('batch-size must be between 1 and 187')
    today=dt.datetime.now(ZoneInfo('Europe/Moscow')).date()
    names=json.loads((ROOT/'data/faculty-names.json').read_text())
    path=ROOT/'data/faculty.json'
    previous=json.loads(path.read_text()) if path.exists() else {}
    old={r['id']:r for r in previous.get('teachers',[])}
    records=[dict(old.get(identity(name)['id'],{'status':'not_checked','schedule_file':None}),**identity(name)) for name in names]
    batch=choose_batch(records,len(records) if args.all else args.batch_size)
    updated={r['id']:r for r in records}
    failures=0;attempts=0;paused=False
    for record in batch:
        result=fetch_teacher(record,today);updated[result['id']]=result;attempts+=1
        failures=failures+1 if result['status'] in ('stale','source_error') else 0
        if failures>=3:
            paused=True;print('Source unavailable three times in a row; preserving remaining schedules until the next queued batch',flush=True);break
    records=[updated[r['id']] for r in records]
    unresolved=assignments(records)
    output={'schema':1,'checked_at':today.isoformat(),'source':SOURCE,'refresh_batch_size':args.batch_size,'teachers':records,'unresolved':unresolved}
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
    print(json.dumps({'teachers':len(records),'schedules':sum(bool(r.get('schedule_file')) for r in records),'matched_groups':sum(bool(r['groups']) for r in records),'attempted':attempts,'paused':paused,'unresolved':unresolved},ensure_ascii=False),flush=True)

if __name__=='__main__':main()

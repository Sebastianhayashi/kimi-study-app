#!/usr/bin/env python3
"""Lucubro dogfood 观测台：dump 一门课的全部关键状态。

用法:
  python3 scripts/dogfood-watch.py              # 列出所有课程
  python3 scripts/dogfood-watch.py <course-id>  # 完整 dump
  python3 scripts/dogfood-watch.py <id> --tail  # 只看反馈事件和最近动态
"""
import json, sys, os, glob, datetime

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'courses')

def ts(ms):
    try: return datetime.datetime.fromtimestamp(int(ms)/1000).strftime('%m-%d %H:%M:%S')
    except Exception: return str(ms)

def load(p, default=None):
    try:
        with open(p) as f: return json.load(f)
    except Exception: return default

def brief(course):
    cid = os.path.basename(course)
    meta = load(os.path.join(course, 'meta.json'), {})
    onb = load(os.path.join(course, 'onboarding.json'), {})
    lessons = sorted(glob.glob(os.path.join(course, 'lessons', '*.html')))
    acts = load(os.path.join(course, 'learning-activity.json'), [])
    fb = [a for a in acts if isinstance(a, dict) and a.get('type') == 'lesson-feedback']
    print(f"{cid}  {meta.get('title','?')[:40]:40s}  state={onb.get('state','?'):12s} lessons={len(lessons)} feedback={len(fb)}")

def dump(course, tail_only=False):
    cid = os.path.basename(course)
    meta = load(os.path.join(course, 'meta.json'), {})
    onb = load(os.path.join(course, 'onboarding.json'), {})
    print(f"=== {cid} | {meta.get('title','?')} | state={onb.get('state')}")
    if not tail_only:
        mp = os.path.join(course, 'MISSION.md')
        print("\n--- MISSION.md ---")
        print(open(mp).read()[:3000] if os.path.exists(mp) else "(missing)")
    acts = load(os.path.join(course, 'learning-activity.json'), [])
    fb = [a for a in acts if isinstance(a, dict) and a.get('type') == 'lesson-feedback']
    print(f"\n--- 反馈事件 ({len(fb)}) ---")
    for a in fb:
        print(f"  [{ts(a.get('timestamp'))}] {a.get('lessonFile','?')} -> {a.get('signal', a)}")
    print(f"\n--- 最近活动 (last 12) ---")
    for a in acts[-12:]:
        if isinstance(a, dict):
            extra = {k: v for k, v in a.items() if k not in ('id', 'type', 'timestamp')}
            print(f"  [{ts(a.get('timestamp'))}] {a.get('type')} {json.dumps(extra, ensure_ascii=False)[:180]}")
    lessons = sorted(glob.glob(os.path.join(course, 'lessons', '*.html')))
    print(f"\n--- lessons ({len(lessons)}) ---")
    for l in lessons: print(' ', os.path.basename(l))
    ge = os.path.join(course, 'generation-events.jsonl')
    if os.path.exists(ge):
        lines = open(ge).read().strip().splitlines()
        print(f"\n--- generation events (last 6 of {len(lines)}) ---")
        for ln in lines[-6:]:
            try:
                e = json.loads(ln)
                print(f"  [{ts(e.get('timestamp', e.get('ts','?')))}] {e.get('type', '?')} {json.dumps({k:v for k,v in e.items() if k not in ('type','timestamp','ts')}, ensure_ascii=False)[:200]}")
            except Exception: print(' ', ln[:200])

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    tail = '--tail' in sys.argv
    courses = sorted(glob.glob(os.path.join(ROOT, '*')))
    if not args:
        for c in courses:
            if os.path.isdir(c): brief(c)
    else:
        target = None
        for c in courses:
            if os.path.basename(c).startswith(args[0]): target = c; break
        if not target: print('course not found:', args[0]); sys.exit(1)
        dump(target, tail)

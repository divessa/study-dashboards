import importlib.util
import json
import sqlite3
import tempfile
from pathlib import Path
spec = importlib.util.spec_from_file_location('export_campus', Path(__file__).with_name('export_campus.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as tmp:
    db = Path(tmp) / 'test.sqlite'
    out = Path(tmp) / 'export.json'
    c = sqlite3.connect(db)
    c.executescript('CREATE TABLE state(id INTEGER, revision INTEGER, json TEXT); CREATE TABLE history(id INTEGER, saved TEXT, json TEXT); CREATE TABLE progress_history(id INTEGER, saved TEXT, kind TEXT, record_id TEXT, before_json TEXT, after_json TEXT);')
    c.execute('INSERT INTO state VALUES(1, 2, ?)', (json.dumps({'courses': []}),))
    c.execute('INSERT INTO history VALUES(1, ?, ?)', ('2026-01-01', json.dumps({'courses': []})))
    c.execute('INSERT INTO progress_history VALUES(1, ?, ?, ?, ?, ?)', ('2026-01-01', 'courses', 'test', '{}', '{"status":"done"}'))
    c.commit(); c.close()
    before = db.read_bytes()
    module.export_database(db, out)
    bundle = json.loads(out.read_text(encoding='utf-8'))
    assert bundle['current']['revision'] == 2 and len(bundle['history']) == 1 and len(bundle['progressHistory']) == 1
    assert db.read_bytes() == before
    try: module.export_database(db, out)
    except FileExistsError: pass
    else: raise AssertionError('Overwrite was allowed')
print('SQLite export tests passed: current state, both history tables, read-only source, overwrite protection.')

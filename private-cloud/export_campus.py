"""Read a Campus SQLite database consistently without changing it.

Writes an explicit local-only backup. Never sends records over the network.
"""
import argparse
import json
import sqlite3
from pathlib import Path


def export_database(source: Path, destination: Path):
    source = source.resolve(strict=True)
    destination = destination.resolve()
    if source == destination:
        raise ValueError('Source and destination must differ')
    if destination.exists():
        raise FileExistsError('Refusing to overwrite an existing backup')
    uri = source.as_uri() + '?mode=ro'
    connection = sqlite3.connect(uri, uri=True)
    try:
        connection.execute('PRAGMA query_only=ON')
        connection.execute('BEGIN')
        row = connection.execute('SELECT revision, json FROM state WHERE id=1').fetchone()
        if row is None:
            raise ValueError('No current Campus state')
        old_states = [dict(id=i, saved=saved, data=json.loads(raw)) for i, saved, raw in connection.execute('SELECT id, saved, json FROM history ORDER BY id')]
        progress = [dict(id=i, saved=saved, kind=kind, recordId=record_id, before=json.loads(before), after=json.loads(after)) for i, saved, kind, record_id, before, after in connection.execute('SELECT id, saved, kind, record_id, before_json, after_json FROM progress_history ORDER BY id')]
        bundle = dict(format='campus-sqlite-export', version=1, current=dict(revision=row[0], data=json.loads(row[1])), history=old_states, progressHistory=progress)
        connection.rollback()
    finally:
        connection.close()
    with destination.open('x', encoding='utf-8') as stream:
        json.dump(bundle, stream, ensure_ascii=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    private_dir = (Path(__file__).parent / 'local').resolve()
    private_dir.mkdir(exist_ok=True)
    output = args.output.resolve()
    if not output.is_relative_to(private_dir):
        parser.error('Output must be inside private-cloud/local, which is excluded from Git')
    export_database(args.database, output)
    print('Local backup created. Keep it private; it contains academic records.')

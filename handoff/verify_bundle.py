"""Verify handoff integrity only. No network, API key or production database used."""
from pathlib import Path
import hashlib
import json
import re

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'SOURCE_MANIFEST.json').read_text())
source_root = Path(manifest['source_root'])
def digest(data):
    return hashlib.sha256(data).hexdigest()

for row in manifest['reference_files'] + manifest['generated_files']:
    path = root / row['path']
    assert path.is_file(), f'Missing: {path}'
    assert digest(path.read_bytes()) == row['sha256'], f'Changed bundle file: {path}'

for row in manifest['reference_files']:
    source = source_root / row['source_path']
    if source.is_file():
        assert digest(source.read_bytes()) == row['source_sha256'], f'Source changed since extraction: {source}'

asset_dir = root / 'handoff'
original = json.loads((asset_dir / 'rubric-source-sw-behavioural-1.2.json').read_text())
adapted = json.loads((asset_dir / 'rubric-meeting-coach-1.0.json').read_text())
assert len(original['scores']) == len(adapted['scores']) == 7
assert sum(len(s['criteria']) for s in original['scores']) == 25
assert [len(s['criteria']) for s in original['scores']] == [3, 4, 4, 3, 4, 3, 4]

# Independently check every extracted content string occurs as a literal in the SQL.
sql = (root / 'reference/crm/scripts/seed-scorecard-behavioural-1.2.sql').read_text()
literal = r"'((?:[^']|'')*)'"
literals = {re.sub(r'\s+', ' ', x.replace("''", "'")).strip() for x in re.findall(literal, sql)}
for score in original['scores']:
    for value in [score['name'], score['short_name'], score['description'], *score['anchors'].values(),
                  *[c['text'] for c in score['criteria']]]:
        assert value in literals, f'Not in source SQL: {value}'

restored = json.loads(json.dumps(adapted).replace('meeting-coach-behavioural-1.0', 'sw-behavioural-1.2'))
restored['scores'][4]['criteria'][1]['text'] = restored['scores'][4]['criteria'][1]['text'].replace('what the adviser does', 'what Pierre does')
assert restored == original, 'Unexpected standalone rubric change'

expected_paths = {r['path'] for r in manifest['reference_files'] + manifest['generated_files']} | {'SOURCE_MANIFEST.json'}
actual_paths = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
assert actual_paths == expected_paths, f'Unlisted files: {actual_paths - expected_paths}'
for rel in actual_paths:
    assert not any(part in {'.git', 'node_modules', '__pycache__'} for part in Path(rel).parts)
    assert not Path(rel).name.startswith('.env')
print(f'PASS: {len(actual_paths)} files, hashes verified, 7 scores/25 criteria, one declared rubric wording change. No app built or API calls made.')

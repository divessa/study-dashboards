import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
const file = 'private-cloud/generated.rules';
const valid = spawnSync(process.execPath, ['private-cloud/generate-rules.mjs', 'owner_test_123']);
assert.equal(valid.status, 0);
const rules = readFileSync(file, 'utf8');
assert.match(rules, /request\.auth\.uid == 'owner_test_123'/);
assert.match(rules, /allow read, write: if false/);
assert.match(rules, /allow update, delete: if false/);
unlinkSync(file);
for (const uid of ['', "abc' || true", 'some/path']) {
  const result = spawnSync(process.execPath, ['private-cloud/generate-rules.mjs', uid]);
  assert.notEqual(result.status, 0);
}
console.log('Rules generation tests passed; emulator authorization tests are still required.');

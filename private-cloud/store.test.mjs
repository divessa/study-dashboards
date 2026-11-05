import assert from 'node:assert/strict';
import { createCloudStore, ConflictError } from './store.mjs';
let records = new Map();
const key = (parts) => parts.flat().join('/');
const api = {
  doc: (base,...parts) => key([typeof base === 'string' ? base : '',...parts]),
  collection: (base,...parts) => key([typeof base === 'string' ? base : '',...parts]),
  getDocFromServer: async ref => snap(records.get(ref)),
  getDocsFromServer: async ref => ({ docs: [...records.entries()].filter(([k])=>k.startsWith(ref+'/')).map(([,v])=>snap(v)) }),
  runTransaction: async (_db, fn) => {
    const writes=[]; const result=await fn({get:async ref=>snap(records.get(ref)),set:(ref,v)=>writes.push([ref,structuredClone(v)])});
    for(const [ref,v] of writes) records.set(ref,v); return result;
  },
};
function snap(v) { return {exists:()=>v!==undefined,data:()=>structuredClone(v)}; }
const validate = value => { if(!Array.isArray(value?.records)) throw Error('invalid'); return value; };
const store=createCloudStore({db:{},api,ownerUid:'owner',dashboard:'ects',validate});
assert.equal(await store.load(),null);
assert.deepEqual((await store.initialize({records:['first']})).revision,1);
await assert.rejects(store.initialize({records:['overwrite']}), ConflictError);
assert.equal((await store.load()).data.records[0],'first');
assert.equal((await store.save(1,{records:['second']})).revision,2);
await assert.rejects(store.save(1,{records:['stale']}),ConflictError);
assert.equal((await store.load()).data.records[0],'second');
const backup=await store.exportBackup(); assert.equal(backup.history[0].data.records[0],'first');
await assert.rejects(store.save(2,{records:['x'.repeat(810000)]}),/size/);
assert.equal((await store.load()).revision,2);
console.log('Cloud adapter tests passed: initialization, conflicts, history, size guard.');

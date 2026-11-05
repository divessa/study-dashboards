/** Firestore adapter; all writes use online transactions and reject stale revisions. */
export class ConflictError extends Error {
  constructor(message = 'Cloud data changed. Export any unsaved changes before reloading.') { super(message); this.name = 'ConflictError'; }
}
const encodedSize = value => new TextEncoder().encode(JSON.stringify(value)).length;
export function createCloudStore({ db, api, ownerUid, dashboard, validate }) {
  if (!ownerUid || !['ects', 'campus'].includes(dashboard)) throw Error('Missing owner or invalid dashboard');
  const root = ['users', ownerUid, 'dashboards', dashboard];
  const currentRef = api.doc(db, ...root);
  const historyRef = api.collection(db, ...root, 'history');
  const legacyRef = api.collection(db, ...root, 'legacy');
  const validatePayload = data => {
    const result = validate(data);
    if (encodedSize(result) > 800000) throw Error('Data exceeds the safe cloud document size; no changes were saved.');
    return result;
  };
  async function load() {
    const snapshot = await api.getDocFromServer(currentRef);
    if (!snapshot.exists()) return null;
    const value = snapshot.data();
    if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw Error('Invalid cloud revision');
    return { revision: value.revision, data: validatePayload(value.data), legacyCount: value.legacyCount ?? 0 };
  }
  async function initialize(data, legacy = []) {
    const payload = validatePayload(data);
    if (!Array.isArray(legacy) || legacy.length > 300 || legacy.some(x => !x || typeof x !== 'object' || encodedSize(x) > 800000)) throw Error('Invalid imported history');
    return api.runTransaction(db, async tx => {
      const existing = await tx.get(currentRef);
      if (existing.exists()) throw new ConflictError('Cloud data already exists. Initial import did not overwrite it.');
      const next = { revision: 1, data: payload, legacyCount: legacy.length, savedAt: new Date().toISOString() };
      legacy.forEach((entry, i) => tx.set(api.doc(legacyRef, String(i).padStart(6, '0')), entry));
      tx.set(currentRef, next);
      return { revision: next.revision, data: payload };
    });
  }
  async function save(expectedRevision, data) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw Error('Invalid expected revision');
    const payload = validatePayload(data);
    return api.runTransaction(db, async tx => {
      const existing = await tx.get(currentRef);
      if (!existing.exists() || existing.data().revision !== expectedRevision) throw new ConflictError();
      const previous = existing.data();
      const previousData = validatePayload(previous.data);
      const next = { revision: expectedRevision + 1, data: payload, legacyCount: previous.legacyCount ?? 0, savedAt: new Date().toISOString() };
      const historical = api.doc(historyRef, String(expectedRevision));
      tx.set(historical, { revision: expectedRevision, data: previousData, savedAt: previous.savedAt });
      tx.set(currentRef, next);
      return { revision: next.revision, data: payload };
    });
  }
  async function restore(expectedRevision, data, legacy) {
    const payload = validatePayload(data);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || !Array.isArray(legacy) || legacy.length > 300 || legacy.some(x => !x || typeof x !== 'object' || encodedSize(x) > 800000)) throw Error('Invalid backup');
    return api.runTransaction(db, async tx => {
      const existing = await tx.get(currentRef);
      if (!existing.exists() || existing.data().revision !== expectedRevision) throw new ConflictError();
      const previous = existing.data();
      const count = previous.legacyCount ?? 0;
      const next = { revision: expectedRevision + 1, data: payload, legacyCount: count + legacy.length, savedAt: new Date().toISOString() };
      tx.set(api.doc(historyRef, String(expectedRevision)), { revision: expectedRevision, data: validatePayload(previous.data), savedAt: previous.savedAt });
      legacy.forEach((entry, i) => tx.set(api.doc(legacyRef, String(count + i).padStart(6, '0')), entry));
      tx.set(currentRef, next);
      return {revision: next.revision, data: payload};
    });
  }
  async function exportBackup() {
    // Server-only reads: never mistake an offline cache for a complete backup.
    const current = await load();
    if (!current) throw Error('No cloud data to export');
    const snapshots = await api.getDocsFromServer(historyRef);
    const history = snapshots.docs.map(item => {
      const record = item.data();
      if (!Number.isSafeInteger(record.revision) || record.revision < 1 || record.revision >= current.revision) throw Error('Cloud history is inconsistent. Retry export.');
      return { revision: record.revision, savedAt: record.savedAt, data: validatePayload(record.data) };
    }).sort((a,b) => a.revision - b.revision);
    if (history.length !== current.revision - 1 || history.some((item, index) => item.revision !== index + 1)) throw Error('Cloud history is incomplete. No backup was exported.');
    const legacyDocs = await api.getDocsFromServer(legacyRef);
    const legacy = legacyDocs.docs.map(item => item.data());
    if (legacy.length !== current.legacyCount) throw Error('Imported history is incomplete. No backup was exported.');
    // Re-read to avoid exporting a mixture of versions if another device saved during export.
    const end = await load();
    if (!end || end.revision !== current.revision) throw new ConflictError('Cloud data changed during export. Retry.');
    return { format: 'study-cloud-backup', version: 1, dashboard, current, history, legacy };
  }
  function watch(onRevision, onError) {
    return api.onSnapshot(currentRef, { includeMetadataChanges: true }, snapshot => {
      // Never treat a cached or locally pending snapshot as confirmed synchronization.
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.exists()) { onRevision(null); return; }
      const revision = snapshot.data().revision;
      if (!Number.isSafeInteger(revision) || revision < 1) { onError(Error('Invalid cloud revision')); return; }
      onRevision(revision);
    }, onError);
  }
  return { load, initialize, save, restore, exportBackup, watch };
}

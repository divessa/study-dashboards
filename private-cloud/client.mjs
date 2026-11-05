import { initializeApp, getApps } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, setLogLevel, doc, collection, getDocFromServer, getDocsFromServer, runTransaction, onSnapshot } from 'firebase/firestore';
import { createCloudStore } from './store.mjs';

// Config contains Firebase web identifiers only, never a service-account key.
export async function createPrivateClient(config, ownerUid) {
  if (!config?.apiKey || !config?.authDomain || !config?.projectId || !config?.appId || !ownerUid) throw Error('Private cloud setup is incomplete.');
  const app = getApps().find(item => item.name === 'study-private') || initializeApp(config, 'study-private');
  const auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  setLogLevel('silent'); // Avoid logging Firestore requests or record values.
  const db = getFirestore(app); // Memory-only Firestore cache; no academic records cached on disk.
  const api = { doc, collection, getDocFromServer, getDocsFromServer, runTransaction, onSnapshot };
  return {
    observe(callback) {
      return onAuthStateChanged(auth, async user => {
        if (user && user.uid !== ownerUid) { await signOut(auth); callback(null, 'This account is not authorized.'); return; }
        callback(user, '');
      });
    },
    async login() {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      if (result.user.uid !== ownerUid) { await signOut(auth); throw Error('This account is not authorized.'); }
    },
    logout: () => signOut(auth),
    store(dashboard, validate) {
      if (!auth.currentUser || auth.currentUser.uid !== ownerUid) throw Error('Authentication required.');
      return createCloudStore({db, api, ownerUid, dashboard, validate});
    },
  };
}

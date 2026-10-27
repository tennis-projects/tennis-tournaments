import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = useEmulator || Boolean(config.apiKey && config.projectId);

const app = initializeApp(
  useEmulator
    ? { apiKey: 'demo-key', projectId: 'demo-tennis', appId: 'demo' }
    : firebaseConfigured
      ? config
      : { apiKey: 'missing', projectId: 'missing', appId: 'missing' },
);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Локальная разработка без интернета: `npm run emulators` + VITE_USE_EMULATOR=true
if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

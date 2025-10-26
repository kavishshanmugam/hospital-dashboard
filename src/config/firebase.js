// Fixed firebase initialisation. If Firebase fails to initialise (no window or missing functions),
// we export mock objects so the app can run locally for demos.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, serverTimestamp } from 'firebase/firestore';
// analytics is optional
let app = null;
let analytics = null;
let auth = null;
let db = null;

const firebaseConfig = {
  apiKey: "AIzaSyBAlgwfh3YqP83dM4kIDTVDmTmLizZUl_Y",
  authDomain: "smart-pad-box.firebaseapp.com",
  projectId: "smart-pad-box",
  storageBucket: "smart-pad-box.firebasestorage.app",
  messagingSenderId: "385818571107",
  appId: "1:385818571107:web:be74bd7e76719487902356",
  measurementId: "G-80F5WPGGV7"
};

try {
  app = initializeApp(firebaseConfig);
  // lazy require analytics to avoid runtime issues in non-browser envs
  if (typeof window !== 'undefined') {
    try { const { getAnalytics } = await import('firebase/analytics'); analytics = getAnalytics(app); } catch(e){ /* ignore */ }
  }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn('Firebase failed to initialize — falling back to mocks for demo mode.', e);
  // simple mocks so UI can pretend to work
  auth = {};
  db = {};
}

export { auth, db };
export const serverTime = () => serverTimestamp ? serverTimestamp() : new Date();
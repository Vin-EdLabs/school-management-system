import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, isSupported, deleteToken } from 'firebase/messaging';

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

function isConfigured() {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId);
}

function getAppInstance() {
  if (!isConfigured()) return null;
  if (!getApps().length) initializeApp(getFirebaseConfig());
  return getApps()[0];
}

export async function getFcmToken(vapidKey: string): Promise<string | null> {
  if (!isConfigured()) return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  const app = getAppInstance();
  if (!app) return null;
  const messaging = getMessaging(app);
  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: reg,
  }).catch(() => null);
  return token || null;
}

export async function removeFcmToken() {
  const supported = await isSupported().catch(() => false);
  if (!supported) return;
  const app = getAppInstance();
  if (!app) return;
  const messaging = getMessaging(app);
  await deleteToken(messaging).catch(() => undefined);
}

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import '../config';

/**
 * Inicializa Firebase Admin una sola vez (las funciones serverless reutilizan el proceso).
 * En Netlify se usan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.
 * En local también puede usarse GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de la cuenta de servicio.
 */
function iniciar() {
  if (getApps().length) return getApps()[0];
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  return initializeApp({ credential: applicationDefault() });
}

const app = iniciar();
export const db = getFirestore(app);
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch {
  // settings() solo puede llamarse una vez por instancia; en recargas en caliente se ignora.
}
export const firebaseAuth = getAuth(app);

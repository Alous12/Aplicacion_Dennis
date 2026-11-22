import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import '../config';

/**
 * Problema de configuración detectado al arrancar (null = todo bien).
 * Nunca contiene secretos: solo nombres de variables y el tipo de error.
 */
export let errorConfiguracion: string | null = null;

/**
 * Normaliza la clave privada sin importar cómo se pegó:
 * con o sin comillas, con "\n" literales, con saltos de línea reales o con \r de Windows.
 */
function normalizarClave(clave: string): string {
  let k = clave.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  return k.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim() + '\n';
}

const limpiar = (v?: string) => v?.trim().replace(/^["']|["']$/g, '').trim();

/**
 * Inicializa Firebase Admin una sola vez (las funciones serverless reutilizan el proceso).
 * En Netlify se usan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.
 * En local también puede usarse GOOGLE_APPLICATION_CREDENTIALS o el emulador.
 */
function iniciar() {
  if (getApps().length) return getApps()[0];
  const projectId = limpiar(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = limpiar(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  const faltan = [
    ['JWT_SECRET', process.env.JWT_SECRET],
    ['FIREBASE_PROJECT_ID', projectId],
    ['FIREBASE_CLIENT_EMAIL', clientEmail],
    ['FIREBASE_PRIVATE_KEY', privateKey],
  ]
    .filter(([, v]) => !v)
    .map(([n]) => n);
  const usaAlternativa = !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (projectId && clientEmail && privateKey) {
    const clave = normalizarClave(privateKey);
    if (!clave.startsWith('-----BEGIN PRIVATE KEY-----') || !clave.includes('-----END PRIVATE KEY-----')) {
      errorConfiguracion =
        'FIREBASE_PRIVATE_KEY no tiene el formato correcto: debe empezar con -----BEGIN PRIVATE KEY----- y terminar con -----END PRIVATE KEY-----';
    } else {
      try {
        return initializeApp({ credential: cert({ projectId, clientEmail, privateKey: clave }) });
      } catch (e) {
        errorConfiguracion = `FIREBASE_PRIVATE_KEY no es válida (${(e as Error).message}). Cópiala de nuevo del JSON de la cuenta de servicio.`;
      }
    }
  } else if (!usaAlternativa) {
    errorConfiguracion = `Faltan variables de entorno: ${faltan.join(', ')}`;
  }
  if (!errorConfiguracion && faltan.includes('JWT_SECRET')) errorConfiguracion = 'Falta la variable de entorno JWT_SECRET';
  if (errorConfiguracion) console.error('[configuración]', errorConfiguracion);

  // Arranca igual para que la API responda con un mensaje claro en vez de caerse (502).
  return initializeApp(projectId ? { credential: applicationDefault(), projectId } : { credential: applicationDefault() });
}

const app = iniciar();
if (!errorConfiguracion && !process.env.JWT_SECRET) errorConfiguracion = 'Falta la variable de entorno JWT_SECRET';
export const db = getFirestore(app);
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch {
  // settings() solo puede llamarse una vez por instancia; en recargas en caliente se ignora.
}
export const firebaseAuth = getAuth(app);

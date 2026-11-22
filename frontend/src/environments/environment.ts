/**
 * Configuración pública del frontend.
 * La configuración web de Firebase NO es secreta (se puede publicar); la seguridad la da el backend.
 * Consola Firebase → Configuración del proyecto → Tus apps → App web → "Configuración del SDK".
 */
export const environment = {
  apiUrl: '/api',
  nombreIglesia: 'Mi Iglesia',
  moneda: { codigo: 'BOB', locale: 'es-BO' },
  firebase: {
    apiKey: 'TU_API_KEY',
    authDomain: 'tu-proyecto.firebaseapp.com',
    projectId: 'tu-proyecto',
    appId: 'TU_APP_ID',
  },
};

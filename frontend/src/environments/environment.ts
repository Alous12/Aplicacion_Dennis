/**
 * Configuración pública del frontend.
 * La configuración web de Firebase NO es secreta (se puede publicar); la seguridad la da el backend.
 * Consola Firebase → Configuración del proyecto → Tus apps → App web → "Configuración del SDK".
 */
export const environment = {
  apiUrl: '/api',
  nombreIglesia: 'CDF-Cochambamba',
  moneda: { codigo: 'BOB', locale: 'es-BO' },
  firebase: {
    apiKey: "AIzaSyDNTpV1KfByuFC5ET5MKIde6Ub1sVdtxv8",
    authDomain: "iglesia-gestion-8edbc.firebaseapp.com",
    projectId: "iglesia-gestion-8edbc",
    appId: "1:900319620748:web:53c3871afc799ff48e95a9",
  },
};

import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { db } from '../lib/firebase';
import { requiere, requiereAdmin } from '../lib/permisos';

/**
 * Configuración guardada en Firestore. Las imágenes (logo y QR) se guardan comprimidas como data URL
 * dentro del documento (límite 1 MiB), así no se necesita Cloud Storage (no disponible en el plan Spark).
 */
const imagen = (max: number) =>
  z
    .string()
    .max(max, 'La imagen es demasiado grande')
    .refine((v) => v === '' || /^data:image\/(png|jpeg|webp);base64,/.test(v), 'Formato de imagen no válido');

// ───────── General: logo y nombre de la iglesia ─────────
// Lectura PÚBLICA (la pantalla de ingreso muestra el logo antes de iniciar sesión).
export const configuracionPublica = Router();
const refGeneral = db.collection('configuracion').doc('general');

configuracionPublica.get('/general', async (_req, res) => {
  const d = (await refGeneral.get()).data() ?? {};
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ logo: d.logo ?? '', nombre: d.nombre ?? '' });
});

// ───────── Rutas con sesión ─────────
export const configuracion = Router();

configuracion.put('/general', requiereAdmin, async (req, res) => {
  const datos = z
    .object({
      logo: imagen(400_000),
      nombre: z.string().trim().max(80).optional().default(''),
    })
    .parse(req.body);
  await refGeneral.set({ ...datos, actualizadoPor: req.usuario!.email, actualizadoEn: FieldValue.serverTimestamp() });
  res.json(datos);
});

// ───────── Ventas: imagen del QR de cobro ─────────
const refVentas = db.collection('configuracion').doc('ventas');

configuracion.get('/ventas', async (_req, res) => {
  const d = (await refVentas.get()).data() ?? {};
  res.json({ qrImagen: d.qrImagen ?? '', qrDescripcion: d.qrDescripcion ?? '' });
});

configuracion.put('/ventas', requiere('ventas'), async (req, res) => {
  const datos = z
    .object({
      qrImagen: imagen(900_000),
      qrDescripcion: z.string().trim().max(300).optional().default(''),
    })
    .parse(req.body);
  await refVentas.set({ ...datos, actualizadoPor: req.usuario!.email, actualizadoEn: FieldValue.serverTimestamp() });
  res.json(datos);
});

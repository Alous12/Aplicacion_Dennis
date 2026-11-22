import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requiereRol } from '../lib/auth';
import { db } from '../lib/firebase';

/**
 * Configuración de ventas: imagen del QR de cobro.
 * La imagen se guarda comprimida como data URL dentro de Firestore (límite 1 MiB por documento),
 * así no se necesita Cloud Storage (que ya no está disponible en el plan gratuito Spark).
 */
export const configuracion = Router();
const ref = db.collection('configuracion').doc('ventas');

configuracion.get('/ventas', async (_req, res) => {
  const doc = await ref.get();
  const d = doc.data() ?? {};
  res.json({ qrImagen: d.qrImagen ?? '', qrDescripcion: d.qrDescripcion ?? '' });
});

configuracion.put('/ventas', requiereRol('admin'), async (req, res) => {
  const datos = z
    .object({
      qrImagen: z
        .string()
        .max(900_000, 'La imagen es demasiado grande')
        .refine((v) => v === '' || /^data:image\/(png|jpeg|webp);base64,/.test(v), 'Formato de imagen no válido'),
      qrDescripcion: z.string().trim().max(300).optional().default(''),
    })
    .parse(req.body);
  await ref.set({ ...datos, actualizadoPor: req.usuario!.email, actualizadoEn: FieldValue.serverTimestamp() });
  res.json(datos);
});

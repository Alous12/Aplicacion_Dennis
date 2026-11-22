import { Router } from 'express';
import { z } from 'zod';
import { requiereRol } from '../lib/auth';
import { HttpError } from '../lib/errores';
import { db } from '../lib/firebase';

/**
 * Gestión de usuarios para administradores.
 * Desde la web NO se pueden crear administradores ni cambiar roles:
 * los admins se crean solo en la base de datos (ver scripts/crear-admin.ts).
 */
export const usuariosRouter = Router();
const usuarios = db.collection('usuarios');

usuariosRouter.use(requiereRol('admin'));

usuariosRouter.get('/', async (_req, res) => {
  const snap = await usuarios.get();
  res.json(
    snap.docs.map((d) => {
      const u = d.data();
      return {
        id: d.id,
        email: u.email,
        nombre: u.nombre,
        rol: u.rol,
        estado: u.estado,
        celulaId: u.celulaId ?? '',
        proveedores: u.proveedores ?? [],
        creadoEn: u.creadoEn?.toDate?.()?.toISOString() ?? null,
        ultimoAcceso: u.ultimoAcceso?.toDate?.()?.toISOString() ?? null,
      };
    }),
  );
});

async function usuarioNoAdmin(id: string) {
  const ref = usuarios.doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new HttpError(404, 'Usuario no encontrado');
  if (doc.data()!.rol === 'admin') {
    throw new HttpError(403, 'Los administradores solo se gestionan directamente en la base de datos');
  }
  return ref;
}

/**
 * Aprobar / desactivar / reactivar un usuario (no admin) y/o asignarle la célula que lidera
 * (celulaId vacío = no es líder).
 */
usuariosRouter.patch('/:id', async (req, res) => {
  const cambios = z
    .object({
      estado: z.enum(['activo', 'inactivo', 'pendiente']).optional(),
      celulaId: z.string().max(100).optional(),
    })
    .refine((c) => c.estado !== undefined || c.celulaId !== undefined, 'Nada que actualizar')
    .parse(req.body);
  const ref = await usuarioNoAdmin(String(req.params.id));
  if (cambios.celulaId && !(await db.collection('celulas').doc(cambios.celulaId).get()).exists) {
    throw new HttpError(400, 'La célula no existe');
  }
  const datos = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
  await ref.update(datos);
  res.json({ id: ref.id, ...datos });
});

usuariosRouter.delete('/:id', async (req, res) => {
  const ref = await usuarioNoAdmin(String(req.params.id));
  await ref.delete();
  res.status(204).end();
});

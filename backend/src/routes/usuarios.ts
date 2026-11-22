import bcrypt from 'bcryptjs';
import { Router, type Request } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpError } from '../lib/errores';
import { db } from '../lib/firebase';
import { categorias, contexto, requiere } from '../lib/permisos';

/**
 * Gestión de cuentas (permiso "usuarios").
 * - Crear cuentas con contraseña, aprobar/desactivar, asignar iglesia en el hogar, cambiar contraseña.
 * - Asignar la CATEGORÍA (que define los permisos) solo lo hace el administrador.
 * - Los administradores no se crean ni se modifican desde la web (solo en la base de datos).
 */
export const usuariosRouter = Router();
const usuarios = db.collection('usuarios');

usuariosRouter.use(requiere('usuarios'));

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
        categoriaId: u.categoriaId ?? '',
        proveedores: u.proveedores ?? [],
        creadoEn: u.creadoEn?.toDate?.()?.toISOString() ?? null,
        ultimoAcceso: u.ultimoAcceso?.toDate?.()?.toISOString() ?? null,
      };
    }),
  );
});

async function validarReferencias(datos: { celulaId?: string; categoriaId?: string }) {
  if (datos.celulaId && !(await db.collection('celulas').doc(datos.celulaId).get()).exists) {
    throw new HttpError(400, 'La iglesia en el hogar no existe');
  }
  if (datos.categoriaId && !(await categorias()).has(datos.categoriaId)) {
    throw new HttpError(400, 'La categoría no existe');
  }
}

/**
 * Devuelve el usuario a modificar comprobando que quien actúa puede hacerlo:
 * nadie toca a un administrador; quien no es admin no toca a usuarios que tienen permisos (ni a sí mismo).
 */
async function usuarioModificable(req: Request, id: string) {
  const ref = usuarios.doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new HttpError(404, 'Usuario no encontrado');
  const u = doc.data()!;
  if (u.rol === 'admin') {
    throw new HttpError(403, 'Los administradores solo se gestionan directamente en la base de datos');
  }
  if (!(await contexto(req)).esAdmin) {
    if (id === req.usuario!.sub) throw new HttpError(403, 'No puedes modificar tu propia cuenta desde aquí');
    const permisos = u.categoriaId ? ((await categorias()).get(u.categoriaId)?.permisos ?? []) : [];
    if (permisos.length) throw new HttpError(403, 'Solo un administrador puede modificar a usuarios con permisos');
  }
  return ref;
}

async function soloAdminAsignaCategoria(req: Request, categoriaId: string | undefined) {
  if (categoriaId !== undefined && !(await contexto(req)).esAdmin) {
    throw new HttpError(403, 'Solo un administrador puede asignar categorías (definen los permisos)');
  }
}

const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100);

/** El administrador (o quien tenga el permiso) crea una cuenta con contraseña; queda activa. */
usuariosRouter.post('/', async (req, res) => {
  const datos = z
    .object({
      nombre: z.string().trim().min(2, 'Nombre muy corto').max(80),
      email: z.email('Correo inválido'),
      password,
      celulaId: z.string().max(100).optional().default(''),
      categoriaId: z.string().max(100).optional(),
    })
    .parse(req.body);
  await soloAdminAsignaCategoria(req, datos.categoriaId || undefined);
  await validarReferencias(datos);
  const id = datos.email.trim().toLowerCase();
  try {
    await usuarios.doc(id).create({
      email: id,
      nombre: datos.nombre,
      rol: 'usuario',
      estado: 'activo',
      passwordHash: await bcrypt.hash(datos.password, 10),
      proveedores: ['password'],
      celulaId: datos.celulaId,
      categoriaId: datos.categoriaId ?? '',
      creadoPor: req.usuario!.email,
      creadoEn: FieldValue.serverTimestamp(),
    });
  } catch {
    throw new HttpError(409, 'Ya existe una cuenta con ese correo');
  }
  res.status(201).json({ id, email: id, nombre: datos.nombre, rol: 'usuario', estado: 'activo', celulaId: datos.celulaId, categoriaId: datos.categoriaId ?? '' });
});

/** Aprobar / desactivar, cambiar nombre, iglesia en el hogar o categoría. */
usuariosRouter.patch('/:id', async (req, res) => {
  const cambios = z
    .object({
      nombre: z.string().trim().min(2).max(80).optional(),
      estado: z.enum(['activo', 'inactivo', 'pendiente']).optional(),
      celulaId: z.string().max(100).optional(),
      categoriaId: z.string().max(100).optional(),
    })
    .refine((c) => Object.values(c).some((v) => v !== undefined), 'Nada que actualizar')
    .parse(req.body);
  await soloAdminAsignaCategoria(req, cambios.categoriaId);
  const ref = await usuarioModificable(req, String(req.params.id));
  await validarReferencias(cambios);
  const datos = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
  await ref.update(datos);
  res.json({ id: ref.id, ...datos });
});

/** Asigna una contraseña nueva (p. ej. si la persona la olvidó). */
usuariosRouter.put('/:id/password', async (req, res) => {
  const { password: nueva } = z.object({ password }).parse(req.body);
  const ref = await usuarioModificable(req, String(req.params.id));
  await ref.update({ passwordHash: await bcrypt.hash(nueva, 10), proveedores: FieldValue.arrayUnion('password') });
  res.json({ mensaje: 'Contraseña actualizada' });
});

usuariosRouter.delete('/:id', async (req, res) => {
  const ref = await usuarioModificable(req, String(req.params.id));
  await ref.delete();
  res.status(204).end();
});

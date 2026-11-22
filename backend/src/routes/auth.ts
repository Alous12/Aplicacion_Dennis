import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { firmarToken, requiereAuth, type Rol } from '../lib/auth';
import { HttpError } from '../lib/errores';
import { db, firebaseAuth } from '../lib/firebase';

export const auth = Router();
const usuarios = db.collection('usuarios');

/** El id del documento del usuario es su email en minúsculas (garantiza unicidad). */
const idDe = (email: string) => email.trim().toLowerCase();

interface UsuarioDoc {
  email: string;
  nombre: string;
  rol: Rol;
  estado: 'pendiente' | 'activo' | 'inactivo';
  passwordHash?: string;
  proveedores?: string[];
  celulaId?: string;
}

function respuestaSesion(id: string, u: UsuarioDoc) {
  if (u.estado === 'pendiente') {
    throw new HttpError(403, 'Tu cuenta está pendiente de aprobación por un administrador.');
  }
  if (u.estado !== 'activo') throw new HttpError(403, 'Tu cuenta está desactivada.');
  const datos = { sub: id, email: u.email, nombre: u.nombre, rol: u.rol };
  // celulaId no va en el JWT: se lee de la base en cada petición para que los cambios del admin apliquen al instante.
  return { token: firmarToken(datos), usuario: { ...datos, celulaId: u.celulaId ?? '' } };
}

// ───────── Login con email + contraseña ─────────
auth.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.email(), password: z.string().min(1) }).parse(req.body);
  const id = idDe(email);
  const doc = await usuarios.doc(id).get();
  const u = doc.data() as UsuarioDoc | undefined;
  if (!u) throw new HttpError(401, 'Correo o contraseña incorrectos');
  if (!u.passwordHash) {
    throw new HttpError(401, 'Esta cuenta no tiene contraseña. Ingresa con Google.');
  }
  if (!(await bcrypt.compare(password, u.passwordHash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }
  const sesion = respuestaSesion(id, u);
  await usuarios.doc(id).update({ ultimoAcceso: FieldValue.serverTimestamp() });
  res.json(sesion);
});

// ───────── Registro (siempre rol "usuario", queda pendiente de aprobación) ─────────
auth.post('/registro', async (req, res) => {
  const { nombre, email, password } = z
    .object({
      nombre: z.string().trim().min(2, 'Nombre muy corto').max(80),
      email: z.email('Correo inválido'),
      password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100),
    })
    .parse(req.body);
  const id = idDe(email);
  const ref = usuarios.doc(id);
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    // create() falla si el documento ya existe → evita duplicados.
    await ref.create({
      email: id,
      nombre,
      rol: 'usuario',
      estado: 'pendiente',
      passwordHash,
      proveedores: ['password'],
      creadoEn: FieldValue.serverTimestamp(),
    });
  } catch {
    throw new HttpError(409, 'Ya existe una cuenta con ese correo');
  }
  res.status(201).json({ mensaje: 'Cuenta creada. Un administrador debe aprobarla antes de que puedas ingresar.' });
});

// ───────── Login con Google ─────────
// El frontend obtiene un ID token de Firebase Auth (popup de Google) y lo envía aquí.
// Se verifica con Firebase Admin y se emite el JWT propio de la aplicación.
auth.post('/google', async (req, res) => {
  const { idToken } = z.object({ idToken: z.string().min(10) }).parse(req.body);
  let decod;
  try {
    decod = await firebaseAuth.verifyIdToken(idToken);
  } catch {
    throw new HttpError(401, 'Token de Google inválido');
  }
  if (!decod.email || !decod.email_verified) throw new HttpError(401, 'El correo de Google no está verificado');

  const id = idDe(decod.email);
  const ref = usuarios.doc(id);
  const doc = await ref.get();
  let u = doc.data() as UsuarioDoc | undefined;
  if (!u) {
    u = {
      email: id,
      nombre: decod.name ?? id,
      rol: 'usuario',
      estado: 'pendiente',
      proveedores: ['google'],
    };
    await ref.set({ ...u, creadoEn: FieldValue.serverTimestamp() });
  } else if (!u.proveedores?.includes('google')) {
    await ref.update({ proveedores: FieldValue.arrayUnion('google') });
  }
  const sesion = respuestaSesion(id, u);
  await ref.update({ ultimoAcceso: FieldValue.serverTimestamp() });
  res.json(sesion);
});

// ───────── Usuario actual (datos frescos de la base: rol, estado y célula que lidera) ─────────
auth.get('/yo', requiereAuth, async (req, res) => {
  const u = (await usuarios.doc(req.usuario!.sub).get()).data() as UsuarioDoc | undefined;
  if (!u || u.estado !== 'activo') throw new HttpError(401, 'Tu cuenta ya no está activa');
  res.json({ sub: req.usuario!.sub, email: u.email, nombre: u.nombre, rol: u.rol, celulaId: u.celulaId ?? '' });
});

// ───────── Cambiar contraseña propia ─────────
auth.post('/cambiar-password', requiereAuth, async (req, res) => {
  const { actual, nueva } = z
    .object({ actual: z.string().optional().default(''), nueva: z.string().min(8, 'Mínimo 8 caracteres').max(100) })
    .parse(req.body);
  const ref = usuarios.doc(req.usuario!.sub);
  const u = (await ref.get()).data() as UsuarioDoc | undefined;
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  if (u.passwordHash && !(await bcrypt.compare(actual, u.passwordHash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta');
  }
  await ref.update({
    passwordHash: await bcrypt.hash(nueva, 10),
    proveedores: FieldValue.arrayUnion('password'),
  });
  res.json({ mensaje: 'Contraseña actualizada' });
});

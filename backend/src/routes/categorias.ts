import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpError } from '../lib/errores';
import { db } from '../lib/firebase';
import { invalidarCategorias, requiere } from '../lib/permisos';

/**
 * Categorías de los integrantes (Pastor, Anciano, Diácono, Líder…).
 * Son solo un IDENTIFICADOR: no dan permisos. Los permisos se configuran a cada usuario.
 * Se gestionan desde la página Usuarios (permiso "usuarios").
 */
export const categoriasRouter = Router();
const col = db.collection('categorias');

/** Categorías iniciales (las del diagrama). Se crean una sola vez; luego se pueden cambiar. */
const INICIALES = ['Pastor', 'Anciano', 'Ministro', 'Diácono', 'Líder', 'Sub líder'];

let sembrado = false;
async function sembrarSiHaceFalta() {
  if (sembrado) return;
  const marca = db.collection('configuracion').doc('semillas');
  await db.runTransaction(async (tx) => {
    const m = await tx.get(marca);
    if (m.data()?.categorias) return;
    INICIALES.forEach((nombre, orden) =>
      tx.set(col.doc(), { nombre, orden, creadoPor: 'sistema', creadoEn: FieldValue.serverTimestamp() }),
    );
    tx.set(marca, { categorias: true }, { merge: true });
  });
  sembrado = true;
  invalidarCategorias();
}

const esquema = z.object({
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(60),
  orden: z.coerce.number().int().min(0).max(999).optional(),
});

// Todos los usuarios pueden verlas (se muestran en perfiles y listas).
categoriasRouter.get('/', async (_req, res) => {
  await sembrarSiHaceFalta();
  const snap = await col.get();
  const lista = snap.docs.map((d) => ({ id: d.id, nombre: String(d.data().nombre ?? ''), orden: Number(d.data().orden ?? 999) }));
  lista.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
  res.json(lista);
});

async function nombreLibre(nombre: string, excepto?: string) {
  const snap = await col.get();
  const repetido = snap.docs.some((d) => d.id !== excepto && String(d.data().nombre).toLowerCase() === nombre.toLowerCase());
  if (repetido) throw new HttpError(409, `Ya existe una categoría llamada "${nombre}"`);
}

categoriasRouter.post('/', requiere('usuarios'), async (req, res) => {
  const datos = esquema.parse(req.body);
  await nombreLibre(datos.nombre);
  const ref = await col.add({ ...datos, orden: datos.orden ?? 999, creadoPor: req.usuario!.email, creadoEn: FieldValue.serverTimestamp() });
  invalidarCategorias();
  res.status(201).json({ id: ref.id, nombre: datos.nombre, orden: datos.orden ?? 999 });
});

categoriasRouter.put('/:id', requiere('usuarios'), async (req, res) => {
  const ref = col.doc(String(req.params.id));
  if (!(await ref.get()).exists) throw new HttpError(404, 'Categoría no encontrada');
  const datos = esquema.parse(req.body);
  await nombreLibre(datos.nombre, ref.id);
  const limpio = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined));
  await ref.set({ ...limpio, actualizadoPor: req.usuario!.email, actualizadoEn: FieldValue.serverTimestamp() }, { merge: true });
  invalidarCategorias();
  res.json({ id: ref.id, ...datos });
});

categoriasRouter.delete('/:id', requiere('usuarios'), async (req, res) => {
  const id = String(req.params.id);
  const enUso = await db.collection('usuarios').where('categoriaId', '==', id).get();
  if (!enUso.empty) {
    throw new HttpError(409, `No se puede eliminar: ${enUso.size} usuario(s) tienen esta categoría. Cámbiales la categoría primero.`);
  }
  await col.doc(id).delete();
  invalidarCategorias();
  res.status(204).end();
});

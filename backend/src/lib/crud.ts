import { Router, type Request } from 'express';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import type { ZodType } from 'zod';
import { HttpError } from './errores';
import { db } from './firebase';
import { requiere, type Acceso } from './permisos';

export interface OpcionesCrud {
  coleccion: string;
  esquema: ZodType<Record<string, unknown>>;
  leer: Acceso;
  /** Quién puede crear. */
  escribir: Acceso;
  /** Quién puede editar (por defecto, quien puede crear). */
  editar?: Acceso;
  borrar: Acceso;
  /**
   * Restringe qué registros ve el usuario (p. ej. un líder solo ve su iglesia en el hogar).
   * Devuelve un filtro, o null si puede ver todo.
   */
  alcance?: (req: Request) => Promise<((item: Record<string, unknown>) => boolean) | null>;
  /** Campo de fecha (YYYY-MM-DD) que permite filtrar con ?desde=&hasta= */
  campoFecha?: string;
  /** Transforma/completa los datos antes de guardar (p. ej. calcular totales). */
  preparar?: (
    datos: Record<string, unknown>,
    req: Request,
    esNuevo: boolean,
    /** Datos guardados antes del cambio (solo al editar). */
    previo?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function aObjeto(id: string, data: DocumentData) {
  const { creadoEn, actualizadoEn, ...resto } = data;
  return {
    id,
    ...resto,
    creadoEn: creadoEn?.toDate?.()?.toISOString() ?? null,
    actualizadoEn: actualizadoEn?.toDate?.()?.toISOString() ?? null,
  };
}

/** Crea un router REST (GET, GET/:id, POST, PUT/:id, DELETE/:id) sobre una colección de Firestore. */
export function crearCrud(op: OpcionesCrud): Router {
  const router = Router();
  const col = db.collection(op.coleccion);

  router.get('/', requiere(op.leer), async (req, res) => {
    let consulta: FirebaseFirestore.Query = col;
    const { desde, hasta } = req.query;
    if (op.campoFecha) {
      if (typeof desde === 'string' && FECHA.test(desde)) consulta = consulta.where(op.campoFecha, '>=', desde);
      if (typeof hasta === 'string' && FECHA.test(hasta)) consulta = consulta.where(op.campoFecha, '<=', hasta);
    }
    const snap = await consulta.get();
    const filtro = op.alcance ? await op.alcance(req) : null;
    const items = snap.docs.map((d) => aObjeto(d.id, d.data())).filter((it) => !filtro || filtro(it));
    if (op.campoFecha) {
      const campo = op.campoFecha;
      items.sort((a, b) => String((b as Record<string, unknown>)[campo] ?? '').localeCompare(String((a as Record<string, unknown>)[campo] ?? '')));
    }
    res.json(items);
  });

  router.get('/:id', requiere(op.leer), async (req, res) => {
    const doc = await col.doc(String(req.params.id)).get();
    if (!doc.exists) throw new HttpError(404, 'No encontrado');
    const item = aObjeto(doc.id, doc.data()!);
    const filtro = op.alcance ? await op.alcance(req) : null;
    if (filtro && !filtro(item)) throw new HttpError(404, 'No encontrado');
    res.json(item);
  });

  router.post('/', requiere(op.escribir), async (req, res) => {
    let datos = op.esquema.parse(req.body);
    if (op.preparar) datos = await op.preparar(datos, req, true);
    const ref = await col.add({
      ...datos,
      creadoPor: req.usuario!.email,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    const doc = await ref.get();
    res.status(201).json(aObjeto(doc.id, doc.data()!));
  });

  router.put('/:id', requiere(op.editar ?? op.escribir), async (req, res) => {
    const ref = col.doc(String(req.params.id));
    const previo = await ref.get();
    if (!previo.exists) throw new HttpError(404, 'No encontrado');
    if (op.alcance) {
      const filtro = await op.alcance(req);
      if (filtro && !filtro(aObjeto(previo.id, previo.data()!))) throw new HttpError(404, 'No encontrado');
    }
    let datos = op.esquema.parse(req.body);
    if (op.preparar) datos = await op.preparar(datos, req, false, previo.data());
    await ref.set(
      { ...datos, actualizadoPor: req.usuario!.email, actualizadoEn: FieldValue.serverTimestamp() },
      { merge: true },
    );
    const doc = await ref.get();
    res.json(aObjeto(doc.id, doc.data()!));
  });

  router.delete('/:id', requiere(op.borrar), async (req, res) => {
    await col.doc(String(req.params.id)).delete();
    res.status(204).end();
  });

  return router;
}

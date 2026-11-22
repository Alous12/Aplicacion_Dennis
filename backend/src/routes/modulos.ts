import { Router, type Request } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { crearCrud } from '../lib/crud';
import { HttpError } from '../lib/errores';
import { db } from '../lib/firebase';
import { contexto, tienePermiso, type Acceso } from '../lib/permisos';

// ───────── Ayudantes de validación ─────────
const texto = (max = 200) => z.string().trim().max(max).optional().default('');
const requerido = (max = 200) => z.string().trim().min(1, 'Requerido').max(max);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');
const fechaOpcional = z.union([fecha, z.literal('')]).optional().default('');
const hora = z.union([z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'), z.literal('')]).optional().default('');
const numero = z.coerce.number().min(0, 'No puede ser negativo').optional().default(0);
const monto = z.coerce.number().positive('Debe ser mayor a 0');
const booleano = z.boolean().optional().default(false);
const ids = z.array(z.string().max(100)).max(2000).optional().default([]);
const opcion = <T extends [string, ...string[]]>(valores: T, porDefecto: T[number]) =>
  z.enum(valores).optional().default(porDefecto as never);

// ───────── Permisos por módulo ─────────
// 'todos' = cualquier usuario con sesión; si no, el permiso que debe tener su categoría (ver lib/permisos.ts).
const TODOS: Acceso = 'todos';

export const modulos = Router();

// ═════════ Miembros & Visitantes ═════════
modulos.use(
  '/personas',
  crearCrud({
    coleccion: 'personas',
    leer: TODOS,
    escribir: TODOS,
    borrar: 'miembros',
    esquema: z.object({
      nombre: requerido(80),
      apellido: texto(80),
      telefono: texto(30),
      email: z.union([z.email('Correo inválido'), z.literal('')]).optional().default(''),
      fechaNacimiento: fechaOpcional,
      direccion: texto(200),
      tipo: opcion(['miembro', 'visitante'], 'visitante'),
      etapa: opcion(
        ['registro', 'bautismo_discipulado', 'integracion_celula', 'seguimiento_visitante', 'invitacion_actividades'],
        'registro',
      ),
      bautizado: booleano,
      celulaId: texto(100),
      fechaRegistro: fechaOpcional,
      notas: texto(1000),
    }),
  }),
);

modulos.use(
  '/celulas',
  crearCrud({
    coleccion: 'celulas', // iglesias en el hogar
    leer: TODOS,
    escribir: 'miembros',
    borrar: 'miembros',
    esquema: z.object({
      nombre: requerido(80),
      lider: texto(100),
      anfitrion: texto(100),
      direccion: texto(200),
      dia: opcion(['', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'], ''),
      hora,
      activa: z.boolean().optional().default(true),
    }),
  }),
);

// ═════════ Eventos & Cultos ═════════
modulos.use(
  '/eventos',
  crearCrud({
    coleccion: 'eventos',
    campoFecha: 'fecha',
    leer: TODOS,
    escribir: TODOS,
    borrar: 'eventos',
    esquema: z.object({
      titulo: requerido(120),
      tipo: opcion(['culto', 'evento', 'reunion', 'conferencia', 'otro'], 'culto'),
      fecha,
      hora,
      lugar: texto(150),
      descripcion: texto(2000),
      estado: opcion(['planificado', 'publicado', 'realizado', 'evaluado', 'cancelado'], 'planificado'),
      requiereInscripcion: booleano,
      cupo: numero,
      inscritos: ids,
      asistentes: ids,
      asistenciaExtra: numero, // asistentes que no están registrados como personas
      evaluacionCalificacion: z.coerce.number().int().min(0).max(5).optional().default(0),
      evaluacionComentarios: texto(2000),
    }),
  }),
);

// ═════════ Ministerios & Voluntarios ═════════
modulos.use(
  '/ministerios',
  crearCrud({
    coleccion: 'ministerios',
    leer: TODOS,
    escribir: 'ministerios',
    borrar: 'ministerios',
    esquema: z.object({
      nombre: requerido(80),
      descripcion: texto(1000),
      lider: texto(100),
      necesidades: texto(1000),
      voluntariosRequeridos: numero,
      convocatoriaAbierta: booleano,
    }),
  }),
);

modulos.use(
  '/voluntarios',
  crearCrud({
    coleccion: 'voluntarios',
    leer: TODOS,
    escribir: TODOS,
    borrar: 'ministerios',
    esquema: z.object({
      ministerioId: requerido(100),
      personaId: requerido(100),
      estado: opcion(['solicitud', 'revision', 'asignado', 'capacitacion', 'activo', 'rechazado', 'inactivo'], 'solicitud'),
      funcion: texto(100),
      perfil: texto(1000),
      capacitaciones: texto(1000),
      eventosAsignados: ids,
      feedback: texto(1000),
      reconocimiento: texto(300),
    }),
  }),
);

// ═════════ Gestión de Recursos ═════════
modulos.use(
  '/inventario',
  crearCrud({
    coleccion: 'inventario',
    leer: TODOS,
    escribir: 'recursos',
    borrar: 'recursos',
    esquema: z.object({
      nombre: requerido(100),
      categoria: opcion(['insumo', 'equipo', 'mobiliario', 'instrumento', 'otro'], 'equipo'),
      cantidad: numero,
      unidad: texto(30),
      estado: opcion(['bueno', 'regular', 'danado'], 'bueno'),
      ubicacion: texto(100),
      notas: texto(500),
    }),
  }),
);

modulos.use(
  '/espacios',
  crearCrud({
    coleccion: 'espacios',
    leer: TODOS,
    escribir: 'recursos',
    borrar: 'recursos',
    esquema: z.object({
      nombre: requerido(80),
      capacidad: numero,
      descripcion: texto(500),
    }),
  }),
);

modulos.use(
  '/reservas',
  crearCrud({
    coleccion: 'reservas',
    campoFecha: 'fecha',
    leer: TODOS,
    escribir: TODOS,
    borrar: TODOS,
    esquema: z.object({
      espacioId: requerido(100),
      fecha,
      horaInicio: hora,
      horaFin: hora,
      responsable: texto(100),
      motivo: texto(300),
    }),
  }),
);

modulos.use(
  '/mantenimientos',
  crearCrud({
    coleccion: 'mantenimientos',
    campoFecha: 'fecha',
    leer: TODOS,
    escribir: TODOS,
    borrar: 'recursos',
    esquema: z.object({
      objetivo: requerido(120),
      tipo: opcion(['preventivo', 'correctivo'], 'preventivo'),
      fecha,
      descripcion: texto(1000),
      responsable: texto(100),
      costo: numero,
      estado: opcion(['pendiente', 'en_proceso', 'completado'], 'pendiente'),
    }),
  }),
);


// ═════════ Iglesias en el hogar: control de asistencia ═════════
// Quien tiene "miembros" gestiona la asistencia de todas; quien tiene "hogar", solo la de SU iglesia en el hogar.
async function puedeGestionarHogar(req: Request, celulaId: string) {
  const ctx = await contexto(req);
  if (ctx.permisos.includes('miembros')) return;
  if (ctx.permisos.includes('hogar') && ctx.celulaId && ctx.celulaId === celulaId) return;
  throw new HttpError(403, 'Solo puedes gestionar la asistencia de tu iglesia en el hogar');
}

const asistencias = db.collection('asistencias');
const idAsistencia = (celulaId: string, f: string) => `${celulaId}_${f}`;

modulos.get('/asistencias', async (req, res) => {
  const celulaId = z.string().min(1, 'Elige una iglesia en el hogar').max(100).parse(req.query.celulaId);
  await puedeGestionarHogar(req, celulaId);
  const desde = typeof req.query.desde === 'string' ? req.query.desde : '';
  const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : '';
  const snap = await asistencias.where('celulaId', '==', celulaId).get();
  const items = snap.docs
    .map((d) => {
      const { creadoEn: _c, actualizadoEn, ...resto } = d.data();
      return { id: d.id, ...resto, fecha: String(resto.fecha ?? ''), actualizadoEn: actualizadoEn?.toDate?.()?.toISOString() ?? null };
    })
    .filter((a) => (!desde || a.fecha >= desde) && (!hasta || a.fecha <= hasta))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  res.json(items);
});

modulos.put('/asistencias/:celulaId/:fecha', async (req, res) => {
  const celulaId = String(req.params.celulaId);
  const f = fecha.parse(req.params.fecha);
  await puedeGestionarHogar(req, celulaId);
  if (!(await db.collection('celulas').doc(celulaId).get()).exists) throw new HttpError(404, 'La iglesia en el hogar no existe');
  const datos = z
    .object({
      presentes: ids, // personas registradas que asistieron
      visitas: numero, // asistentes sin registrar
      notas: texto(1000),
    })
    .parse(req.body);
  const ref = asistencias.doc(idAsistencia(celulaId, f));
  await ref.set({
    ...datos,
    celulaId,
    fecha: f,
    total: datos.presentes.length + Number(datos.visitas),
    actualizadoPor: req.usuario!.email,
    actualizadoEn: FieldValue.serverTimestamp(),
  });
  res.json({ id: ref.id, celulaId, fecha: f, ...datos, total: datos.presentes.length + Number(datos.visitas) });
});

modulos.delete('/asistencias/:celulaId/:fecha', async (req, res) => {
  const celulaId = String(req.params.celulaId);
  await puedeGestionarHogar(req, celulaId);
  await asistencias.doc(idAsistencia(celulaId, fecha.parse(req.params.fecha))).delete();
  res.status(204).end();
});

// ═════════ Tesorería ═════════
async function siguienteRecibo(): Promise<number> {
  const ref = db.collection('contadores').doc('recibos');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const siguiente = ((snap.data()?.valor as number | undefined) ?? 0) + 1;
    tx.set(ref, { valor: siguiente });
    return siguiente;
  });
}

/** Iglesia en el hogar del usuario, si tiene el permiso "hogar" (registrar sus ingresos y asistencia). */
async function hogarPropio(req: Request): Promise<string> {
  const ctx = await contexto(req);
  if (!ctx.permisos.includes('hogar')) throw new HttpError(403, 'No tienes permiso para ver los ingresos de la tesorería');
  if (!ctx.celulaId) throw new HttpError(403, 'No tienes una iglesia en el hogar asignada');
  return ctx.celulaId;
}

// Con permiso "tesoreria" se gestiona todo. Con permiso "hogar" solo se VEN y REGISTRAN
// los ingresos de la propia iglesia en el hogar (no se pueden editar ni borrar).
modulos.use(
  '/ingresos',
  crearCrud({
    coleccion: 'ingresos',
    campoFecha: 'fecha',
    leer: TODOS,
    escribir: TODOS,
    editar: 'tesoreria',
    borrar: 'tesoreria',
    alcance: async (req) => {
      if (await tienePermiso(req, 'tesoreria')) return null;
      const celulaId = await hogarPropio(req);
      return (item) => item.celulaId === celulaId;
    },
    esquema: z.object({
      fecha,
      tipo: opcion(['diezmo', 'ofrenda', 'ofrenda_especial', 'donacion', 'otro'], 'ofrenda'),
      origen: opcion(['culto', 'online', 'celula', 'otro'], 'culto'), // celula = iglesia en el hogar
      celulaId: texto(100),
      eventoId: texto(100),
      personaId: texto(100),
      donante: texto(120),
      metodo: opcion(['efectivo', 'transferencia', 'qr'], 'efectivo'),
      monto,
      descripcion: texto(500),
    }),
    preparar: async (datos, req, esNuevo) => {
      if (await tienePermiso(req, 'tesoreria')) {
        if (datos.origen !== 'celula') datos = { ...datos, celulaId: '' };
        // Si no se eligió, se usa la iglesia en el hogar de quien registra.
        else if (!datos.celulaId) datos = { ...datos, celulaId: (await contexto(req)).celulaId };
        if (datos.origen === 'celula' && !datos.celulaId) throw new HttpError(400, 'Elige la iglesia en el hogar');
      } else {
        // Sin permiso de tesorería solo se registran ingresos de SU iglesia en el hogar, sin importar lo que envíe.
        datos = { ...datos, origen: 'celula', celulaId: await hogarPropio(req), eventoId: '' };
      }
      return esNuevo ? { ...datos, numeroRecibo: await siguienteRecibo() } : datos;
    },
  }),
);

const categoriaEgreso = opcion(['proveedor', 'nomina', 'servicios', 'mantenimiento', 'ministerios', 'eventos', 'otro'], 'otro');
const metodoPago = opcion(['efectivo', 'transferencia', 'qr'], 'efectivo');

modulos.use(
  '/egresos',
  crearCrud({
    coleccion: 'egresos',
    campoFecha: 'fecha',
    leer: 'tesoreria',
    escribir: 'tesoreria',
    borrar: 'tesoreria',
    esquema: z.object({
      fecha,
      categoria: categoriaEgreso,
      beneficiario: texto(120),
      concepto: requerido(200),
      metodo: metodoPago,
      comprobante: texto(60),
      monto,
      pagoRecurrenteId: texto(100),
    }),
  }),
);

// ───────── Pagos recurrentes (alquiler, servicios, sueldos…) con aviso de días restantes ─────────
const FRECUENCIAS = ['semanal', 'quincenal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual'] as const;
type Frecuencia = (typeof FRECUENCIAS)[number];
const MESES_POR_FRECUENCIA: Partial<Record<Frecuencia, number>> = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };

/**
 * Siguiente fecha de pago. Si el mes siguiente es más corto se usa su último día,
 * y `diaBase` recuerda el día original (p. ej. 31) para volver a él en los meses largos.
 */
export function siguienteFecha(iso: string, frecuencia: Frecuencia, diaBase?: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const meses = MESES_POR_FRECUENCIA[frecuencia];
  let r: Date;
  if (!meses) {
    r = new Date(Date.UTC(a, m - 1, d + (frecuencia === 'semanal' ? 7 : 14)));
  } else {
    const ultimo = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
    r = new Date(Date.UTC(a, m - 1 + meses, Math.min(diaBase ?? d, ultimo)));
  }
  return r.toISOString().slice(0, 10);
}

/** Registra el pago (crea el egreso) y pasa la fecha al siguiente periodo, todo en una transacción. */
modulos.post('/pagos-recurrentes/:id/pagar', async (req, res) => {
  if (!(await tienePermiso(req, 'tesoreria'))) throw new HttpError(403, 'No tienes permiso para esta acción');
  const datos = z
    .object({
      fecha,
      monto: monto.optional(),
      metodo: z.enum(['efectivo', 'transferencia', 'qr']).optional(),
      comprobante: texto(60),
    })
    .parse(req.body);
  const ref = db.collection('pagosRecurrentes').doc(String(req.params.id));
  const egresoRef = db.collection('egresos').doc();
  const resultado = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new HttpError(404, 'No encontrado');
    const p = doc.data()!;
    const proximaFecha = siguienteFecha(String(p.proximaFecha), p.frecuencia as Frecuencia, Number(p.diaBase) || undefined);
    tx.set(egresoRef, {
      fecha: datos.fecha,
      categoria: p.categoria ?? 'otro',
      beneficiario: p.beneficiario ?? '',
      concepto: p.concepto,
      metodo: datos.metodo ?? p.metodo ?? 'efectivo',
      comprobante: datos.comprobante,
      monto: datos.monto ?? p.monto,
      pagoRecurrenteId: ref.id,
      creadoPor: req.usuario!.email,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    tx.update(ref, {
      proximaFecha,
      ultimoPago: datos.fecha,
      actualizadoPor: req.usuario!.email,
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    return { egresoId: egresoRef.id, proximaFecha };
  });
  res.status(201).json(resultado);
});

modulos.use(
  '/pagos-recurrentes',
  crearCrud({
    coleccion: 'pagosRecurrentes',
    leer: 'tesoreria',
    escribir: 'tesoreria',
    borrar: 'tesoreria',
    esquema: z.object({
      concepto: requerido(200),
      beneficiario: texto(120),
      categoria: categoriaEgreso,
      metodo: metodoPago,
      monto,
      frecuencia: opcion([...FRECUENCIAS], 'mensual'),
      proximaFecha: fecha,
      diasAviso: z.coerce.number().int().min(0).max(90).optional().default(5),
      activo: z.boolean().optional().default(true),
      notas: texto(500),
    }),
    preparar: (datos) => ({ ...datos, diaBase: Number(String(datos.proximaFecha).slice(8, 10)) }),
  }),
);

modulos.use(
  '/presupuestos',
  crearCrud({
    coleccion: 'presupuestos',
    leer: 'tesoreria',
    escribir: 'tesoreria',
    borrar: 'tesoreria',
    esquema: z.object({
      anio: z.coerce.number().int().min(2000).max(2100),
      mes: z.coerce.number().int().min(0).max(12).optional().default(0), // 0 = todo el año
      tipo: opcion(['ingreso', 'egreso'], 'egreso'),
      categoria: requerido(60),
      montoPlanificado: monto,
      notas: texto(500),
    }),
  }),
);

// ═════════ Ventas ═════════
// Catálogo de productos: lo gestiona quien tenga el permiso "ventas"; todos lo usan al vender.
modulos.use(
  '/productos',
  crearCrud({
    coleccion: 'productos',
    leer: TODOS,
    escribir: 'ventas',
    borrar: 'ventas',
    esquema: z.object({
      nombre: requerido(120),
      precio: monto,
      descripcion: texto(500),
      activo: z.boolean().optional().default(true),
    }),
  }),
);

// El PRECIO no lo decide quien vende: se toma del producto registrado al momento de la venta
// y ya no cambia (aunque después se edite la venta o el precio del producto).
modulos.use(
  '/ventas',
  crearCrud({
    coleccion: 'ventas',
    campoFecha: 'fecha',
    leer: TODOS,
    escribir: TODOS,
    editar: 'ventas',
    borrar: 'ventas',
    // El cuadre de caja (todas las ventas) lo ve quien tiene "cuadre", "ventas" o "tesoreria"; el resto solo ve lo que registró.
    alcance: async (req) => {
      const { permisos } = await contexto(req);
      if (['cuadre', 'ventas', 'tesoreria'].some((p) => permisos.includes(p as never))) return null;
      return (item) => item.creadoPor === req.usuario!.email;
    },
    esquema: z.object({
      fecha,
      productoId: requerido(100),
      cantidad: z.coerce.number().int().min(1, 'Mínimo 1'),
      comprador: texto(120),
      metodoPago: z.enum(['qr', 'efectivo']),
      referencia: texto(80),
      notas: texto(500),
    }),
    preparar: async (datos, _req, esNuevo, previo) => {
      let producto: string;
      let precioUnitario: number;
      if (esNuevo) {
        const p = (await db.collection('productos').doc(String(datos.productoId)).get()).data();
        if (!p || p.activo === false) throw new HttpError(400, 'El producto no existe o no está disponible');
        producto = String(p.nombre);
        precioUnitario = Number(p.precio);
      } else {
        // Al editar se conservan el producto y el precio con los que se registró.
        producto = String(previo!.producto);
        precioUnitario = Number(previo!.precioUnitario);
        datos = { ...datos, productoId: previo!.productoId ?? '' };
      }
      return {
        ...datos,
        producto,
        precioUnitario,
        total: Math.round(Number(datos.cantidad) * precioUnitario * 100) / 100,
      };
    },
  }),
);

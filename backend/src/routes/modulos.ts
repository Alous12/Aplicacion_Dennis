import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Rol } from '../lib/auth';
import { crearCrud } from '../lib/crud';
import { HttpError } from '../lib/errores';
import { db } from '../lib/firebase';

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
// Cambia estos arreglos para ajustar qué puede hacer cada rol.
const TODOS: Rol[] = ['admin', 'usuario'];
const ADMIN: Rol[] = ['admin'];

export const modulos = Router();

// ═════════ Miembros & Visitantes ═════════
modulos.use(
  '/personas',
  crearCrud({
    coleccion: 'personas',
    leer: TODOS,
    escribir: TODOS,
    borrar: ADMIN,
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
    coleccion: 'celulas',
    leer: TODOS,
    escribir: ADMIN,
    borrar: ADMIN,
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
    borrar: ADMIN,
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
    escribir: ADMIN,
    borrar: ADMIN,
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
    borrar: ADMIN,
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
    escribir: ADMIN,
    borrar: ADMIN,
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
    escribir: ADMIN,
    borrar: ADMIN,
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
    borrar: ADMIN,
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

// ═════════ Tesorería (solo administradores) ═════════
async function siguienteRecibo(): Promise<number> {
  const ref = db.collection('contadores').doc('recibos');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const siguiente = ((snap.data()?.valor as number | undefined) ?? 0) + 1;
    tx.set(ref, { valor: siguiente });
    return siguiente;
  });
}

/** Célula que lidera el usuario (asignada por un admin en la colección "usuarios"). */
async function celulaDelLider(req: Request): Promise<string> {
  const doc = await db.collection('usuarios').doc(req.usuario!.sub).get();
  const celulaId = (doc.data()?.celulaId as string | undefined) ?? '';
  if (!celulaId) throw new HttpError(403, 'No eres líder de ninguna célula');
  return celulaId;
}

// Los administradores gestionan todo. Un líder de célula solo puede VER y REGISTRAR
// los ingresos de su propia célula (no puede editarlos ni borrarlos).
modulos.use(
  '/ingresos',
  crearCrud({
    coleccion: 'ingresos',
    campoFecha: 'fecha',
    leer: TODOS,
    escribir: TODOS,
    editar: ADMIN,
    borrar: ADMIN,
    alcance: async (req) => {
      if (req.usuario!.rol === 'admin') return null;
      const celulaId = await celulaDelLider(req);
      return (item) => item.celulaId === celulaId;
    },
    esquema: z.object({
      fecha,
      tipo: opcion(['diezmo', 'ofrenda', 'ofrenda_especial', 'donacion', 'otro'], 'ofrenda'),
      origen: opcion(['culto', 'online', 'celula', 'otro'], 'culto'),
      celulaId: texto(100),
      eventoId: texto(100),
      personaId: texto(100),
      donante: texto(120),
      metodo: opcion(['efectivo', 'transferencia', 'qr'], 'efectivo'),
      monto,
      descripcion: texto(500),
    }),
    preparar: async (datos, req, esNuevo) => {
      if (req.usuario!.rol !== 'admin') {
        // El líder solo registra ingresos de SU célula, sin importar lo que envíe.
        datos = { ...datos, origen: 'celula', celulaId: await celulaDelLider(req), eventoId: '' };
      }
      return esNuevo ? { ...datos, numeroRecibo: await siguienteRecibo() } : datos;
    },
  }),
);

modulos.use(
  '/egresos',
  crearCrud({
    coleccion: 'egresos',
    campoFecha: 'fecha',
    leer: ADMIN,
    escribir: ADMIN,
    borrar: ADMIN,
    esquema: z.object({
      fecha,
      categoria: opcion(['proveedor', 'nomina', 'servicios', 'mantenimiento', 'ministerios', 'eventos', 'otro'], 'otro'),
      beneficiario: texto(120),
      concepto: requerido(200),
      metodo: opcion(['efectivo', 'transferencia', 'qr'], 'efectivo'),
      comprobante: texto(60),
      monto,
    }),
  }),
);

modulos.use(
  '/presupuestos',
  crearCrud({
    coleccion: 'presupuestos',
    leer: ADMIN,
    escribir: ADMIN,
    borrar: ADMIN,
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
// Catálogo de productos: lo gestionan los administradores; todos lo usan al vender.
modulos.use(
  '/productos',
  crearCrud({
    coleccion: 'productos',
    leer: TODOS,
    escribir: ADMIN,
    borrar: ADMIN,
    esquema: z.object({
      nombre: requerido(120),
      precio: monto,
      descripcion: texto(500),
      activo: z.boolean().optional().default(true),
    }),
  }),
);

modulos.use(
  '/ventas',
  crearCrud({
    coleccion: 'ventas',
    campoFecha: 'fecha',
    leer: TODOS,
    escribir: TODOS,
    borrar: ADMIN,
    esquema: z.object({
      fecha,
      productoId: texto(100),
      producto: requerido(120), // nombre guardado al momento de la venta (por si el producto cambia después)
      cantidad: z.coerce.number().int().min(1, 'Mínimo 1'),
      precioUnitario: monto,
      comprador: texto(120),
      metodoPago: z.enum(['qr', 'efectivo']),
      referencia: texto(80),
      notas: texto(500),
    }),
    preparar: (datos) => ({
      ...datos,
      total: Math.round(Number(datos.cantidad) * Number(datos.precioUnitario) * 100) / 100,
    }),
  }),
);

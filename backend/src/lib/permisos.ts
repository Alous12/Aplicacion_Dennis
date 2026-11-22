import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errores';
import { db } from './firebase';

/**
 * Permisos que el administrador asigna a cada categoría (rol) en "Roles y permisos".
 * Un usuario recibe los permisos de su categoría. El administrador (rol "admin") los tiene todos.
 * Debe coincidir con frontend/src/app/core/permisos.ts
 */
export const PERMISOS = [
  'miembros', //    eliminar personas y gestionar las iglesias en el hogar (y su asistencia)
  'hogar', //       asistencia e ingresos de SU propia iglesia en el hogar
  'eventos', //     eliminar eventos
  'ministerios', // gestionar ministerios y eliminar voluntarios
  'recursos', //    inventario, espacios y eliminar mantenimientos
  'tesoreria', //   toda la tesorería
  'ventas', //      productos, QR de cobro, editar y eliminar ventas
  'cuadre', //      cuadre de caja: cuánto se generó cada día en ventas
  'usuarios', //    crear cuentas, aprobarlas y asignar iglesia en el hogar
] as const;

export type Permiso = (typeof PERMISOS)[number];
/** 'todos' = cualquier usuario con sesión. */
export type Acceso = 'todos' | Permiso;

export const esPermiso = (p: unknown): p is Permiso => PERMISOS.includes(p as Permiso);

export interface ContextoUsuario {
  rol: 'admin' | 'usuario';
  esAdmin: boolean;
  celulaId: string;
  categoriaId: string;
  categoria: string;
  permisos: Permiso[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      contexto?: ContextoUsuario;
    }
  }
}

// ───────── Caché corta de categorías (evita leerlas en cada petición) ─────────
interface Categoria {
  nombre: string;
  permisos: Permiso[];
}
let cacheCategorias: { datos: Map<string, Categoria>; vence: number } | null = null;

export function invalidarCategorias() {
  cacheCategorias = null;
}

export async function categorias(): Promise<Map<string, Categoria>> {
  if (cacheCategorias && cacheCategorias.vence > Date.now()) return cacheCategorias.datos;
  const snap = await db.collection('categorias').get();
  const datos = new Map<string, Categoria>();
  for (const d of snap.docs) {
    const c = d.data();
    datos.set(d.id, { nombre: String(c.nombre ?? ''), permisos: ((c.permisos as unknown[]) ?? []).filter(esPermiso) });
  }
  cacheCategorias = { datos, vence: Date.now() + 30_000 };
  return datos;
}

/** Datos frescos del usuario (rol, categoría, permisos, iglesia en el hogar). Se calcula una vez por petición. */
export async function contextoDe(sub: string): Promise<ContextoUsuario> {
  const u = (await db.collection('usuarios').doc(sub).get()).data();
  const activo = u?.estado === 'activo';
  const esAdmin = activo && u?.rol === 'admin';
  const categoriaId = String(u?.categoriaId ?? '');
  const categoria = categoriaId ? (await categorias()).get(categoriaId) : undefined;
  return {
    rol: esAdmin ? 'admin' : 'usuario',
    esAdmin,
    celulaId: String(u?.celulaId ?? ''),
    categoriaId,
    categoria: categoria?.nombre ?? '',
    permisos: esAdmin ? [...PERMISOS] : activo ? (categoria?.permisos ?? []) : [],
  };
}

export async function contexto(req: Request): Promise<ContextoUsuario> {
  if (!req.contexto) req.contexto = await contextoDe(req.usuario!.sub);
  return req.contexto;
}

export async function tienePermiso(req: Request, permiso: Permiso): Promise<boolean> {
  return (await contexto(req)).permisos.includes(permiso);
}

/** Middleware: exige un permiso (o nada si es 'todos'). */
export function requiere(acceso: Acceso) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (acceso !== 'todos' && !(await tienePermiso(req, acceso))) {
      throw new HttpError(403, 'No tienes permiso para esta acción');
    }
    next();
  };
}

/** Middleware: solo el administrador principal (creado en la base de datos). */
export async function requiereAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!(await contexto(req)).esAdmin) throw new HttpError(403, 'Solo un administrador puede hacer esto');
  next();
}

import type { Permiso } from './permisos';

export type Rol = 'admin' | 'usuario';

export interface Usuario {
  sub: string;
  email: string;
  nombre: string;
  rol: Rol;
  /** Iglesia en el hogar asignada. */
  celulaId?: string;
  /** Categoría (rol) asignada por el admin; define los permisos. */
  categoriaId?: string;
  categoria?: string;
  permisos?: Permiso[];
}

export interface Sesion {
  token: string;
  usuario: Usuario;
}

/** Cualquier documento devuelto por la API. */
export interface Registro {
  id: string;
  creadoEn?: string | null;
  actualizadoEn?: string | null;
  creadoPor?: string;
  [campo: string]: any;
}

export interface Opcion {
  valor: string;
  etiqueta: string;
  color?: 'verde' | 'rojo' | 'ambar' | 'azul' | 'morado' | 'gris';
}

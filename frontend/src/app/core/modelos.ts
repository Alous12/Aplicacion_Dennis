export type Rol = 'admin' | 'usuario';

export interface Usuario {
  sub: string;
  email: string;
  nombre: string;
  rol: Rol;
  /** Célula que lidera (asignada por un admin). Vacío = no es líder. */
  celulaId?: string;
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

import type { Opcion, Registro } from '../core/modelos';
import type { Acceso } from '../core/permisos';

export type TipoCampo =
  | 'texto'
  | 'textarea'
  | 'numero'
  | 'moneda'
  | 'fecha'
  | 'hora'
  | 'select'
  | 'booleano'
  | 'email'
  | 'tel'
  | 'relacion';

export interface Campo {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido?: boolean;
  opciones?: Opcion[];
  /** Para tipo 'relacion': colección de la que se eligen los registros. */
  relacion?: string;
  /** Mostrar como columna en la tabla / tarjeta. */
  enTabla?: boolean;
  /** Mostrar como insignia de color (selects). */
  insignia?: boolean;
  /** Permitir filtrar por este campo (selects y relaciones). */
  filtro?: boolean;
  /** Ocupa todo el ancho en el formulario. */
  completo?: boolean;
  defecto?: unknown | (() => unknown);
  ayuda?: string;
  /** Mostrar el campo en el formulario solo si se cumple la condición. */
  visibleSi?: (modelo: Record<string, any>) => boolean;
}

export interface AccionExtra {
  icono: string;
  etiqueta: string;
  ruta?: (r: Registro) => unknown[];
  visibleSi?: (r: Registro) => boolean;
}

export type Modulo = 'miembros' | 'eventos' | 'ministerios' | 'recursos' | 'tesoreria' | 'ventas' | 'admin';

export interface ConfigCrud {
  coleccion: string;
  titulo: string;
  singular: string;
  icono: string;
  modulo: Modulo;
  descripcion?: string;
  campos: Campo[];
  /** Campo que se muestra como título de la tarjeta en el teléfono. */
  campoPrincipal: string;
  /** Quién puede crear y borrar: 'todos' o un permiso (debe coincidir con el backend). */
  escribir: Acceso;
  /** Quién puede editar (por defecto, quien puede crear). */
  editar?: Acceso;
  borrar: Acceso;
  /** Habilita el filtro por rango de fechas (?desde=&hasta=). */
  filtroFecha?: boolean;
  /** Campo numérico a totalizar al pie de la tabla. */
  totalizar?: string;
  /** Orden por defecto en el cliente cuando no hay campo de fecha. */
  ordenarPor?: string;
  acciones?: AccionExtra[];
}

export function opciones(pares: Record<string, string>, colores: Record<string, Opcion['color']> = {}): Opcion[] {
  return Object.entries(pares).map(([valor, etiqueta]) => ({ valor, etiqueta, color: colores[valor] }));
}

/**
 * Permisos que el administrador asigna a cada categoría en "Roles y permisos".
 * Debe coincidir con backend/src/lib/permisos.ts
 */
export const PERMISOS = [
  {
    clave: 'miembros',
    etiqueta: 'Personas e iglesias en el hogar',
    descripcion: 'Eliminar personas, crear y editar iglesias en el hogar y llevar la asistencia de todas.',
    icono: 'groups',
  },
  {
    clave: 'hogar',
    etiqueta: 'Su iglesia en el hogar',
    descripcion: 'Registrar la asistencia y los ingresos de la iglesia en el hogar que tiene asignada.',
    icono: 'cottage',
  },
  { clave: 'eventos', etiqueta: 'Eventos y cultos', descripcion: 'Eliminar eventos.', icono: 'event' },
  {
    clave: 'ministerios',
    etiqueta: 'Ministerios y voluntarios',
    descripcion: 'Crear y editar ministerios y eliminar voluntarios.',
    icono: 'volunteer_activism',
  },
  {
    clave: 'recursos',
    etiqueta: 'Recursos',
    descripcion: 'Inventario, espacios y eliminar registros de mantenimiento.',
    icono: 'inventory_2',
  },
  {
    clave: 'tesoreria',
    etiqueta: 'Tesorería',
    descripcion: 'Ofrendas, diezmos, pagos, pagos recurrentes, presupuesto y reportes.',
    icono: 'account_balance',
  },
  {
    clave: 'ventas',
    etiqueta: 'Ventas y productos',
    descripcion: 'Productos y precios, imagen del QR, editar y eliminar ventas.',
    icono: 'sell',
  },
  {
    clave: 'cuadre',
    etiqueta: 'Cuadre de caja',
    descripcion: 'Ver cuánto se generó cada día en ventas (QR y efectivo) para cuadrar las cuentas.',
    icono: 'price_check',
  },
  {
    clave: 'usuarios',
    etiqueta: 'Usuarios',
    descripcion: 'Crear cuentas, aprobarlas, cambiar contraseñas y asignar la iglesia en el hogar.',
    icono: 'manage_accounts',
  },
] as const;

export type Permiso = (typeof PERMISOS)[number]['clave'];
/** 'todos' = cualquier usuario con sesión. */
export type Acceso = 'todos' | Permiso;

export function etiquetaPermiso(clave: string): string {
  return PERMISOS.find((p) => p.clave === clave)?.etiqueta ?? clave;
}

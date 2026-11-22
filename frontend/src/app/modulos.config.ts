import type { Acceso } from './core/permisos';
import { hoy } from './core/utilidades';
import { opciones, type ConfigCrud } from './shared/crud.config';

/** Permisos: deben coincidir con backend/src/routes/modulos.ts ('todos' o el permiso de la categoría). */
const TODOS: Acceso = 'todos';

// ───────── Catálogos ─────────
export const TIPO_PERSONA = opciones({ miembro: 'Miembro', visitante: 'Visitante' }, { miembro: 'azul', visitante: 'ambar' });

/** Etapas del flujo de Miembros & Visitantes (según el diagrama). */
export const ETAPAS_PERSONA = opciones(
  {
    registro: 'Registrado',
    bautismo_discipulado: 'Bautismo / Discipulado',
    integracion_celula: 'Integración a iglesia en el hogar',
    seguimiento_visitante: 'Seguimiento de visitante',
    invitacion_actividades: 'Invitación a actividades',
  },
  {
    registro: 'gris',
    bautismo_discipulado: 'azul',
    integracion_celula: 'verde',
    seguimiento_visitante: 'ambar',
    invitacion_actividades: 'morado',
  },
);

export const DIAS = opciones({
  '': '—',
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
});

export const TIPO_EVENTO = opciones(
  { culto: 'Culto', evento: 'Evento', reunion: 'Reunión', conferencia: 'Conferencia', otro: 'Otro' },
  { culto: 'azul', evento: 'verde', reunion: 'gris', conferencia: 'morado', otro: 'gris' },
);

export const ESTADO_EVENTO = opciones(
  { planificado: 'Planificado', publicado: 'Publicado', realizado: 'Realizado', evaluado: 'Evaluado', cancelado: 'Cancelado' },
  { planificado: 'gris', publicado: 'azul', realizado: 'verde', evaluado: 'morado', cancelado: 'rojo' },
);

/** Flujo de Ministerios & Voluntarios. */
export const ESTADO_VOLUNTARIO = opciones(
  {
    solicitud: 'Solicitud recibida',
    revision: 'Revisión de perfil',
    asignado: 'Seleccionado / asignado',
    capacitacion: 'En capacitación',
    activo: 'Activo',
    rechazado: 'No seleccionado',
    inactivo: 'Inactivo',
  },
  { solicitud: 'gris', revision: 'ambar', asignado: 'azul', capacitacion: 'morado', activo: 'verde', rechazado: 'rojo', inactivo: 'gris' },
);

export const TIPO_INGRESO = opciones(
  { diezmo: 'Diezmo', ofrenda: 'Ofrenda', ofrenda_especial: 'Ofrenda especial', donacion: 'Donación', otro: 'Otro' },
  { diezmo: 'azul', ofrenda: 'verde', ofrenda_especial: 'morado', donacion: 'ambar', otro: 'gris' },
);
export const ORIGEN_INGRESO = opciones({ culto: 'Culto', online: 'Online', celula: 'Iglesia en el hogar', otro: 'Otro' });
export const METODO_PAGO = opciones({ efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR' });
export const CATEGORIA_EGRESO = opciones(
  {
    proveedor: 'Proveedores',
    nomina: 'Nómina',
    servicios: 'Servicios básicos',
    mantenimiento: 'Mantenimiento',
    ministerios: 'Ministerios',
    eventos: 'Eventos',
    otro: 'Otros gastos',
  },
  { proveedor: 'azul', nomina: 'morado', servicios: 'ambar', mantenimiento: 'gris', ministerios: 'verde', eventos: 'verde', otro: 'gris' },
);

// ═════════ Miembros & Visitantes ═════════
export const PERSONAS: ConfigCrud = {
  coleccion: 'personas',
  titulo: 'Miembros & Visitantes',
  singular: 'Persona',
  icono: 'groups',
  modulo: 'miembros',
  descripcion: 'Registro de personas y seguimiento: bautismo/discipulado, integración a iglesias en el hogar y visitantes.',
  campoPrincipal: 'nombre',
  ordenarPor: 'nombre',
  escribir: TODOS,
  borrar: 'miembros',
  campos: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, enTabla: true },
    { clave: 'apellido', etiqueta: 'Apellido', tipo: 'texto', enTabla: true },
    { clave: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: TIPO_PERSONA, enTabla: true, insignia: true, filtro: true, defecto: 'visitante' },
    { clave: 'etapa', etiqueta: 'Etapa', tipo: 'select', opciones: ETAPAS_PERSONA, enTabla: true, insignia: true, filtro: true },
    { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', enTabla: true },
    { clave: 'email', etiqueta: 'Correo', tipo: 'email' },
    { clave: 'fechaNacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'fecha', enTabla: true, ayuda: 'Se usa para la lista de cumpleaños' },
    { clave: 'celulaId', etiqueta: 'Iglesia en el hogar', tipo: 'relacion', relacion: 'celulas', enTabla: true, filtro: true },
    { clave: 'bautizado', etiqueta: 'Bautizado', tipo: 'booleano' },
    { clave: 'fechaRegistro', etiqueta: 'Fecha de registro', tipo: 'fecha', defecto: hoy },
    { clave: 'direccion', etiqueta: 'Dirección', tipo: 'texto', completo: true },
    { clave: 'notas', etiqueta: 'Notas de seguimiento', tipo: 'textarea' },
  ],
};

export const HOGARES: ConfigCrud = {
  coleccion: 'celulas',
  titulo: 'Iglesias en el hogar',
  singular: 'Iglesia en el hogar',
  icono: 'cottage',
  modulo: 'miembros',
  descripcion: 'Grupos que se reúnen en casas. Cada servidor tiene asignada su iglesia en el hogar.',
  campoPrincipal: 'nombre',
  ordenarPor: 'nombre',
  escribir: 'miembros',
  borrar: 'miembros',
  campos: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, enTabla: true },
    { clave: 'lider', etiqueta: 'Líder', tipo: 'texto', enTabla: true },
    { clave: 'anfitrion', etiqueta: 'Anfitrión', tipo: 'texto' },
    { clave: 'dia', etiqueta: 'Día', tipo: 'select', opciones: DIAS, enTabla: true },
    { clave: 'hora', etiqueta: 'Hora', tipo: 'hora', enTabla: true },
    { clave: 'direccion', etiqueta: 'Dirección', tipo: 'texto', completo: true },
    { clave: 'activa', etiqueta: 'Activa', tipo: 'booleano', enTabla: true, defecto: true },
  ],
};

// ═════════ Eventos & Cultos (formulario; la vista es personalizada) ═════════
export const EVENTOS: ConfigCrud = {
  coleccion: 'eventos',
  titulo: 'Eventos & Cultos',
  singular: 'Evento',
  icono: 'event',
  modulo: 'eventos',
  campoPrincipal: 'titulo',
  escribir: TODOS,
  borrar: 'eventos',
  campos: [
    { clave: 'titulo', etiqueta: 'Título', tipo: 'texto', requerido: true, completo: true },
    { clave: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: TIPO_EVENTO },
    { clave: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ESTADO_EVENTO },
    { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, defecto: hoy },
    { clave: 'hora', etiqueta: 'Hora', tipo: 'hora' },
    { clave: 'lugar', etiqueta: 'Lugar', tipo: 'texto', completo: true },
    { clave: 'requiereInscripcion', etiqueta: 'Requiere inscripción', tipo: 'booleano' },
    { clave: 'cupo', etiqueta: 'Cupo (0 = sin límite)', tipo: 'numero', visibleSi: (m) => !!m['requiereInscripcion'] },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
  ],
};

// ═════════ Ministerios & Voluntarios ═════════
export const MINISTERIOS: ConfigCrud = {
  coleccion: 'ministerios',
  titulo: 'Ministerios',
  singular: 'Ministerio',
  icono: 'volunteer_activism',
  modulo: 'ministerios',
  descripcion: 'Identificación de necesidades y convocatoria de voluntarios por ministerio.',
  campoPrincipal: 'nombre',
  ordenarPor: 'nombre',
  escribir: 'ministerios',
  borrar: 'ministerios',
  campos: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, enTabla: true },
    { clave: 'lider', etiqueta: 'Líder', tipo: 'texto', enTabla: true },
    { clave: 'voluntariosRequeridos', etiqueta: 'Voluntarios requeridos', tipo: 'numero', enTabla: true },
    { clave: 'convocatoriaAbierta', etiqueta: 'Convocatoria abierta', tipo: 'booleano', enTabla: true },
    { clave: 'necesidades', etiqueta: 'Necesidades identificadas', tipo: 'textarea' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
  ],
};

export const VOLUNTARIOS: ConfigCrud = {
  coleccion: 'voluntarios',
  titulo: 'Voluntarios',
  singular: 'Voluntario',
  icono: 'handshake',
  modulo: 'ministerios',
  descripcion: 'Solicitudes → revisión de perfil → selección → capacitación → coordinación → feedback.',
  campoPrincipal: 'personaId',
  escribir: TODOS,
  borrar: 'ministerios',
  campos: [
    { clave: 'personaId', etiqueta: 'Persona', tipo: 'relacion', relacion: 'personas', requerido: true, enTabla: true },
    { clave: 'ministerioId', etiqueta: 'Ministerio', tipo: 'relacion', relacion: 'ministerios', requerido: true, enTabla: true, filtro: true },
    { clave: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ESTADO_VOLUNTARIO, enTabla: true, insignia: true, filtro: true },
    { clave: 'funcion', etiqueta: 'Función / rol', tipo: 'texto', enTabla: true },
    { clave: 'perfil', etiqueta: 'Perfil (dones, habilidades, disponibilidad)', tipo: 'textarea' },
    { clave: 'capacitaciones', etiqueta: 'Capacitaciones / entrenamiento', tipo: 'textarea' },
    { clave: 'feedback', etiqueta: 'Feedback', tipo: 'textarea' },
    { clave: 'reconocimiento', etiqueta: 'Reconocimiento', tipo: 'texto', completo: true },
  ],
};

// ═════════ Gestión de Recursos ═════════
export const INVENTARIO: ConfigCrud = {
  coleccion: 'inventario',
  titulo: 'Inventario',
  singular: 'Artículo',
  icono: 'inventory_2',
  modulo: 'recursos',
  descripcion: 'Insumos y equipos de la iglesia.',
  campoPrincipal: 'nombre',
  ordenarPor: 'nombre',
  escribir: 'recursos',
  borrar: 'recursos',
  campos: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, enTabla: true },
    {
      clave: 'categoria',
      etiqueta: 'Categoría',
      tipo: 'select',
      opciones: opciones({ equipo: 'Equipo', insumo: 'Insumo', mobiliario: 'Mobiliario', instrumento: 'Instrumento', otro: 'Otro' }),
      enTabla: true,
      filtro: true,
    },
    { clave: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero', enTabla: true },
    { clave: 'unidad', etiqueta: 'Unidad', tipo: 'texto' },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'select',
      opciones: opciones({ bueno: 'Bueno', regular: 'Regular', danado: 'Dañado' }, { bueno: 'verde', regular: 'ambar', danado: 'rojo' }),
      enTabla: true,
      insignia: true,
      filtro: true,
    },
    { clave: 'ubicacion', etiqueta: 'Ubicación', tipo: 'texto', enTabla: true },
    { clave: 'notas', etiqueta: 'Notas', tipo: 'textarea' },
  ],
};

export const ESPACIOS: ConfigCrud = {
  coleccion: 'espacios',
  titulo: 'Espacios y aulas',
  singular: 'Espacio',
  icono: 'meeting_room',
  modulo: 'recursos',
  campoPrincipal: 'nombre',
  ordenarPor: 'nombre',
  escribir: 'recursos',
  borrar: 'recursos',
  campos: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, enTabla: true },
    { clave: 'capacidad', etiqueta: 'Capacidad (personas)', tipo: 'numero', enTabla: true },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
  ],
};

export const RESERVAS: ConfigCrud = {
  coleccion: 'reservas',
  titulo: 'Reservas de espacios',
  singular: 'Reserva',
  icono: 'event_available',
  modulo: 'recursos',
  campoPrincipal: 'espacioId',
  filtroFecha: true,
  escribir: TODOS,
  borrar: TODOS,
  campos: [
    { clave: 'espacioId', etiqueta: 'Espacio', tipo: 'relacion', relacion: 'espacios', requerido: true, enTabla: true, filtro: true },
    { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, enTabla: true, defecto: hoy },
    { clave: 'horaInicio', etiqueta: 'Desde', tipo: 'hora', enTabla: true },
    { clave: 'horaFin', etiqueta: 'Hasta', tipo: 'hora', enTabla: true },
    { clave: 'responsable', etiqueta: 'Responsable', tipo: 'texto', enTabla: true },
    { clave: 'motivo', etiqueta: 'Motivo', tipo: 'texto', completo: true, enTabla: true },
  ],
};

export const MANTENIMIENTOS: ConfigCrud = {
  coleccion: 'mantenimientos',
  titulo: 'Mantenimiento de instalaciones',
  singular: 'Mantenimiento',
  icono: 'build',
  modulo: 'recursos',
  campoPrincipal: 'objetivo',
  escribir: TODOS,
  borrar: 'recursos',
  campos: [
    { clave: 'objetivo', etiqueta: 'Instalación / equipo', tipo: 'texto', requerido: true, enTabla: true },
    { clave: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opciones({ preventivo: 'Preventivo', correctivo: 'Correctivo' }), enTabla: true },
    { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, enTabla: true, defecto: hoy },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'select',
      opciones: opciones(
        { pendiente: 'Pendiente', en_proceso: 'En proceso', completado: 'Completado' },
        { pendiente: 'ambar', en_proceso: 'azul', completado: 'verde' },
      ),
      enTabla: true,
      insignia: true,
      filtro: true,
    },
    { clave: 'responsable', etiqueta: 'Responsable', tipo: 'texto', enTabla: true },
    { clave: 'costo', etiqueta: 'Costo', tipo: 'moneda', enTabla: true },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
  ],
};

// ═════════ Tesorería ═════════
export const INGRESOS: ConfigCrud = {
  coleccion: 'ingresos',
  titulo: 'Ofrendas, diezmos e ingresos',
  singular: 'Ingreso',
  icono: 'savings',
  modulo: 'tesoreria',
  descripcion: 'Recolección en culto, online y registro de ingresos por iglesia en el hogar.',
  campoPrincipal: 'tipo',
  filtroFecha: true,
  totalizar: 'monto',
  escribir: 'tesoreria',
  editar: 'tesoreria',
  borrar: 'tesoreria',
  acciones: [{ icono: 'receipt_long', etiqueta: 'Ver recibo', ruta: (r) => ['/tesoreria/recibo', r.id] }],
  campos: [
    { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, enTabla: true, defecto: hoy },
    { clave: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: TIPO_INGRESO, enTabla: true, insignia: true, filtro: true },
    { clave: 'origen', etiqueta: 'Origen', tipo: 'select', opciones: ORIGEN_INGRESO, enTabla: true, filtro: true },
    {
      clave: 'celulaId',
      etiqueta: 'Iglesia en el hogar',
      tipo: 'relacion',
      relacion: 'celulas',
      enTabla: true,
      filtro: true,
      visibleSi: (m) => m['origen'] === 'celula',
    },
    { clave: 'eventoId', etiqueta: 'Culto / evento', tipo: 'relacion', relacion: 'eventos', visibleSi: (m) => m['origen'] === 'culto' },
    { clave: 'metodo', etiqueta: 'Método', tipo: 'select', opciones: METODO_PAGO, enTabla: true },
    { clave: 'monto', etiqueta: 'Monto', tipo: 'moneda', requerido: true, enTabla: true },
    { clave: 'personaId', etiqueta: 'Donante (persona registrada)', tipo: 'relacion', relacion: 'personas' },
    { clave: 'donante', etiqueta: 'Donante (otro / nombre libre)', tipo: 'texto' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
  ],
};

/**
 * Vista de quien tiene el permiso "hogar" (líder / sub líder): registra los ingresos de SU iglesia en el hogar.
 * El backend fija automáticamente el origen y la iglesia; solo Tesorería puede editar o borrar.
 */
export const INGRESOS_HOGAR: ConfigCrud = {
  coleccion: 'ingresos',
  titulo: 'Ingresos de mi iglesia en el hogar',
  singular: 'Ingreso',
  icono: 'savings',
  modulo: 'tesoreria',
  descripcion: 'Registra las ofrendas y diezmos recogidos en tu iglesia en el hogar. Para corregir un registro, pide ayuda a Tesorería.',
  campoPrincipal: 'tipo',
  filtroFecha: true,
  totalizar: 'monto',
  escribir: 'hogar',
  editar: 'tesoreria',
  borrar: 'tesoreria',
  acciones: [{ icono: 'receipt_long', etiqueta: 'Ver recibo', ruta: (r) => ['/tesoreria/recibo', r.id] }],
  campos: [
    { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, enTabla: true, defecto: hoy },
    { clave: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: TIPO_INGRESO, enTabla: true, insignia: true, filtro: true },
    { clave: 'metodo', etiqueta: 'Método', tipo: 'select', opciones: METODO_PAGO, enTabla: true },
    { clave: 'monto', etiqueta: 'Monto', tipo: 'moneda', requerido: true, enTabla: true },
    { clave: 'personaId', etiqueta: 'Donante (persona registrada)', tipo: 'relacion', relacion: 'personas' },
    { clave: 'donante', etiqueta: 'Donante (otro / nombre libre)', tipo: 'texto' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
  ],
};

export const EGRESOS: ConfigCrud = {
  coleccion: 'egresos',
  titulo: 'Gestión de pagos',
  singular: 'Pago',
  icono: 'payments',
  modulo: 'tesoreria',
  descripcion: 'Proveedores, nómina y gastos. Los pagos que se repiten (alquiler, servicios...) van en Pagos recurrentes.',
  campoPrincipal: 'concepto',
  filtroFecha: true,
  totalizar: 'monto',
  escribir: 'tesoreria',
  borrar: 'tesoreria',
  campos: [
    { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, enTabla: true, defecto: hoy },
    { clave: 'concepto', etiqueta: 'Concepto', tipo: 'texto', requerido: true, enTabla: true, completo: true },
    { clave: 'categoria', etiqueta: 'Categoría', tipo: 'select', opciones: CATEGORIA_EGRESO, enTabla: true, insignia: true, filtro: true },
    { clave: 'beneficiario', etiqueta: 'Beneficiario / proveedor', tipo: 'texto', enTabla: true },
    { clave: 'metodo', etiqueta: 'Método', tipo: 'select', opciones: METODO_PAGO },
    { clave: 'comprobante', etiqueta: 'N.º de comprobante / factura', tipo: 'texto' },
    { clave: 'monto', etiqueta: 'Monto', tipo: 'moneda', requerido: true, enTabla: true },
  ],
};

// ═════════ Ventas: catálogo de productos (permiso "ventas") ═════════
export const PRODUCTOS: ConfigCrud = {
  coleccion: 'productos',
  titulo: 'Productos',
  singular: 'Producto',
  icono: 'sell',
  modulo: 'ventas',
  descripcion: 'Productos que se pueden vender. Desactiva un producto para ocultarlo en ventas sin borrar su historial.',
  campoPrincipal: 'nombre',
  ordenarPor: 'nombre',
  escribir: 'ventas',
  borrar: 'ventas',
  campos: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, enTabla: true },
    { clave: 'precio', etiqueta: 'Precio', tipo: 'moneda', requerido: true, enTabla: true },
    { clave: 'activo', etiqueta: 'Disponible para la venta', tipo: 'booleano', enTabla: true, defecto: true },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
  ],
};

export const PRESUPUESTOS: ConfigCrud = {
  coleccion: 'presupuestos',
  titulo: 'Presupuesto',
  singular: 'Partida',
  icono: 'request_quote',
  modulo: 'tesoreria',
  descripcion: 'Montos planificados por categoría. Mes 0 = todo el año. Usa las mismas categorías que en pagos e ingresos para comparar en Reportes.',
  campoPrincipal: 'categoria',
  totalizar: 'montoPlanificado',
  escribir: 'tesoreria',
  borrar: 'tesoreria',
  campos: [
    { clave: 'anio', etiqueta: 'Año', tipo: 'numero', requerido: true, enTabla: true, defecto: () => new Date().getFullYear() },
    { clave: 'mes', etiqueta: 'Mes (0 = anual)', tipo: 'numero', enTabla: true, defecto: 0 },
    { clave: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opciones({ egreso: 'Egreso', ingreso: 'Ingreso' }, { egreso: 'rojo', ingreso: 'verde' }), enTabla: true, insignia: true, filtro: true },
    {
      clave: 'categoria',
      etiqueta: 'Categoría',
      tipo: 'select',
      opciones: [...CATEGORIA_EGRESO, ...TIPO_INGRESO.filter((o) => o.valor !== 'otro'), { valor: 'ventas', etiqueta: 'Ventas' }],
      enTabla: true,
      filtro: true,
    },
    { clave: 'montoPlanificado', etiqueta: 'Monto planificado', tipo: 'moneda', requerido: true, enTabla: true },
    { clave: 'notas', etiqueta: 'Notas', tipo: 'textarea' },
  ],
};

// ═════════ Tesorería: pagos recurrentes (vista personalizada con cuenta regresiva) ═════════
export const FRECUENCIAS = opciones({
  semanal: 'Cada semana',
  quincenal: 'Cada 2 semanas',
  mensual: 'Cada mes',
  bimestral: 'Cada 2 meses',
  trimestral: 'Cada 3 meses',
  semestral: 'Cada 6 meses',
  anual: 'Cada año',
});

export const PAGOS_RECURRENTES: ConfigCrud = {
  coleccion: 'pagos-recurrentes',
  titulo: 'Pagos recurrentes',
  singular: 'Pago recurrente',
  icono: 'event_repeat',
  modulo: 'tesoreria',
  descripcion: 'Alquiler, servicios, sueldos... Avisa cuántos días faltan para cada pago.',
  campoPrincipal: 'concepto',
  escribir: 'tesoreria',
  borrar: 'tesoreria',
  campos: [
    { clave: 'concepto', etiqueta: 'Concepto', tipo: 'texto', requerido: true, completo: true },
    { clave: 'monto', etiqueta: 'Monto', tipo: 'moneda', requerido: true },
    { clave: 'frecuencia', etiqueta: 'Se paga', tipo: 'select', opciones: FRECUENCIAS, defecto: 'mensual' },
    { clave: 'proximaFecha', etiqueta: 'Próximo pago', tipo: 'fecha', requerido: true, defecto: hoy },
    { clave: 'diasAviso', etiqueta: 'Avisar con (días de anticipación)', tipo: 'numero', defecto: 5 },
    { clave: 'categoria', etiqueta: 'Categoría', tipo: 'select', opciones: CATEGORIA_EGRESO, defecto: 'servicios' },
    { clave: 'metodo', etiqueta: 'Método', tipo: 'select', opciones: METODO_PAGO },
    { clave: 'beneficiario', etiqueta: 'Beneficiario / proveedor', tipo: 'texto', completo: true },
    { clave: 'activo', etiqueta: 'Activo (desmárcalo para pausar los avisos)', tipo: 'booleano', defecto: true },
    { clave: 'notas', etiqueta: 'Notas', tipo: 'textarea' },
  ],
};

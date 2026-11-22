import { Routes } from '@angular/router';
import { adminGuard, autenticadoGuard, invitadoGuard, permisoGuard } from './core/guards';
import { Shell } from './layout/shell';
import {
  EGRESOS,
  ESPACIOS,
  INGRESOS,
  HOGARES,
  INGRESOS_HOGAR,
  INVENTARIO,
  MANTENIMIENTOS,
  MINISTERIOS,
  PERSONAS,
  PRESUPUESTOS,
  PRODUCTOS,
  RESERVAS,
  VOLUNTARIOS,
} from './modulos.config';
import { CrudPagina } from './shared/crud-pagina';
import { PaginaPestanas } from './shared/pagina-pestanas';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [invitadoGuard],
    title: 'Ingresar',
    loadComponent: () => import('./paginas/login').then((m) => m.Login),
  },
  {
    path: '',
    component: Shell,
    canActivate: [autenticadoGuard],
    canActivateChild: [autenticadoGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', title: 'Inicio', loadComponent: () => import('./paginas/inicio').then((m) => m.Inicio) },

      // Miembros & Visitantes
      { path: 'personas', title: 'Personas', component: CrudPagina, data: { config: PERSONAS } },
      { path: 'cumpleanos', title: 'Cumpleaños', loadComponent: () => import('./paginas/cumpleanos').then((m) => m.Cumpleanos) },
      { path: 'hogares', title: 'Iglesias en el hogar', component: CrudPagina, data: { config: HOGARES } },
      {
        path: 'hogares/asistencia',
        title: 'Asistencia',
        canActivate: [permisoGuard('miembros', 'hogar')],
        loadComponent: () => import('./paginas/asistencia').then((m) => m.Asistencia),
      },
      { path: 'celulas', redirectTo: 'hogares' },

      // Eventos & Cultos
      { path: 'eventos', title: 'Eventos', loadComponent: () => import('./paginas/eventos').then((m) => m.Eventos) },
      { path: 'eventos/:id', title: 'Evento', loadComponent: () => import('./paginas/evento-detalle').then((m) => m.EventoDetalle) },

      // Ministerios & Voluntarios
      { path: 'ministerios', title: 'Ministerios', component: CrudPagina, data: { config: MINISTERIOS } },
      { path: 'voluntarios', title: 'Voluntarios', component: CrudPagina, data: { config: VOLUNTARIOS } },

      // Gestión de Recursos
      {
        path: 'recursos',
        component: PaginaPestanas,
        data: {
          modulo: 'recursos',
          pestanas: [
            { ruta: 'inventario', etiqueta: 'Inventario', icono: 'inventory_2' },
            { ruta: 'espacios', etiqueta: 'Espacios', icono: 'meeting_room' },
            { ruta: 'reservas', etiqueta: 'Reservas', icono: 'event_available' },
            { ruta: 'mantenimiento', etiqueta: 'Mantenimiento', icono: 'build' },
          ],
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'inventario' },
          { path: 'inventario', title: 'Inventario', component: CrudPagina, data: { config: INVENTARIO } },
          { path: 'espacios', title: 'Espacios', component: CrudPagina, data: { config: ESPACIOS } },
          { path: 'reservas', title: 'Reservas', component: CrudPagina, data: { config: RESERVAS } },
          { path: 'mantenimiento', title: 'Mantenimiento', component: CrudPagina, data: { config: MANTENIMIENTOS } },
        ],
      },

      // Tesorería (permiso "tesoreria"; con "hogar" solo los ingresos de su iglesia en el hogar)
      { path: 'mi-hogar', title: 'Ingresos de mi iglesia en el hogar', canActivate: [permisoGuard('hogar')], component: CrudPagina, data: { config: INGRESOS_HOGAR } },
      { path: 'mi-celula', redirectTo: 'mi-hogar' },
      {
        path: 'tesoreria/recibo/:id',
        title: 'Recibo',
        canActivate: [permisoGuard('tesoreria', 'hogar')],
        loadComponent: () => import('./paginas/recibo').then((m) => m.Recibo),
      },
      {
        path: 'tesoreria',
        canActivate: [permisoGuard('tesoreria')],
        component: PaginaPestanas,
        data: {
          modulo: 'tesoreria',
          pestanas: [
            { ruta: 'ingresos', etiqueta: 'Ofrendas / Diezmos', icono: 'savings' },
            { ruta: 'pagos', etiqueta: 'Pagos', icono: 'payments' },
            { ruta: 'recurrentes', etiqueta: 'Pagos recurrentes', icono: 'event_repeat' },
            { ruta: 'libro', etiqueta: 'Registro contable', icono: 'menu_book' },
            { ruta: 'presupuesto', etiqueta: 'Presupuesto', icono: 'request_quote' },
            { ruta: 'reportes', etiqueta: 'Reportes', icono: 'bar_chart' },
          ],
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'ingresos' },
          { path: 'ingresos', title: 'Ingresos', component: CrudPagina, data: { config: INGRESOS } },
          { path: 'pagos', title: 'Pagos', component: CrudPagina, data: { config: EGRESOS } },
          { path: 'recurrentes', title: 'Pagos recurrentes', loadComponent: () => import('./paginas/pagos-recurrentes').then((m) => m.PagosRecurrentes) },
          { path: 'libro', title: 'Registro contable', loadComponent: () => import('./paginas/libro-contable').then((m) => m.LibroContable) },
          { path: 'presupuesto', title: 'Presupuesto', component: CrudPagina, data: { config: PRESUPUESTOS } },
          { path: 'reportes', title: 'Reportes financieros', loadComponent: () => import('./paginas/reportes').then((m) => m.Reportes) },
        ],
      },

      // Ventas
      { path: 'ventas/productos', title: 'Productos', canActivate: [permisoGuard('ventas')], component: CrudPagina, data: { config: PRODUCTOS } },
      { path: 'ventas', title: 'Ventas', loadComponent: () => import('./paginas/ventas').then((m) => m.Ventas) },

      // Administración
      { path: 'usuarios', title: 'Usuarios', canActivate: [permisoGuard('usuarios')], loadComponent: () => import('./paginas/usuarios').then((m) => m.Usuarios) },
      { path: 'roles', title: 'Roles y permisos', canActivate: [adminGuard], loadComponent: () => import('./paginas/roles').then((m) => m.Roles) },
      { path: 'configuracion', title: 'Configuración', canActivate: [adminGuard], loadComponent: () => import('./paginas/configuracion').then((m) => m.Configuracion) },
      { path: 'perfil', title: 'Mi perfil', loadComponent: () => import('./paginas/perfil').then((m) => m.Perfil) },
    ],
  },
  { path: '**', redirectTo: '' },
];

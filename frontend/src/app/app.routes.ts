import { Routes } from '@angular/router';
import { adminGuard, autenticadoGuard, invitadoGuard, liderOAdminGuard } from './core/guards';
import { Shell } from './layout/shell';
import {
  CELULAS,
  EGRESOS,
  ESPACIOS,
  INGRESOS,
  INGRESOS_CELULA,
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
      { path: 'celulas', title: 'Células', component: CrudPagina, data: { config: CELULAS } },

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

      // Tesorería (solo administradores)
      { path: 'mi-celula', title: 'Ingresos de mi célula', canActivate: [liderOAdminGuard], component: CrudPagina, data: { config: INGRESOS_CELULA } },
      {
        path: 'tesoreria/recibo/:id',
        title: 'Recibo',
        canActivate: [liderOAdminGuard],
        loadComponent: () => import('./paginas/recibo').then((m) => m.Recibo),
      },
      {
        path: 'tesoreria',
        canActivate: [adminGuard],
        component: PaginaPestanas,
        data: {
          modulo: 'tesoreria',
          pestanas: [
            { ruta: 'ingresos', etiqueta: 'Ofrendas / Diezmos', icono: 'savings' },
            { ruta: 'pagos', etiqueta: 'Pagos', icono: 'payments' },
            { ruta: 'libro', etiqueta: 'Registro contable', icono: 'menu_book' },
            { ruta: 'presupuesto', etiqueta: 'Presupuesto', icono: 'request_quote' },
            { ruta: 'reportes', etiqueta: 'Reportes', icono: 'bar_chart' },
          ],
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'ingresos' },
          { path: 'ingresos', title: 'Ingresos', component: CrudPagina, data: { config: INGRESOS } },
          { path: 'pagos', title: 'Pagos', component: CrudPagina, data: { config: EGRESOS } },
          { path: 'libro', title: 'Registro contable', loadComponent: () => import('./paginas/libro-contable').then((m) => m.LibroContable) },
          { path: 'presupuesto', title: 'Presupuesto', component: CrudPagina, data: { config: PRESUPUESTOS } },
          { path: 'reportes', title: 'Reportes financieros', loadComponent: () => import('./paginas/reportes').then((m) => m.Reportes) },
        ],
      },

      // Ventas
      { path: 'ventas/productos', title: 'Productos', component: CrudPagina, data: { config: PRODUCTOS } },
      { path: 'ventas', title: 'Ventas', loadComponent: () => import('./paginas/ventas').then((m) => m.Ventas) },

      // Administración
      { path: 'usuarios', title: 'Usuarios', canActivate: [adminGuard], loadComponent: () => import('./paginas/usuarios').then((m) => m.Usuarios) },
      { path: 'perfil', title: 'Mi perfil', loadComponent: () => import('./paginas/perfil').then((m) => m.Perfil) },
    ],
  },
  { path: '**', redirectTo: '' },
];

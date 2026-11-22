import { Component, computed, inject, signal } from '@angular/core';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';

interface UsuarioApp {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'usuario';
  estado: 'pendiente' | 'activo' | 'inactivo';
  celulaId: string;
  proveedores: string[];
  creadoEn: string | null;
  ultimoAcceso: string | null;
}

/**
 * Vista de administrador: aprobar, desactivar o eliminar usuarios.
 * Los administradores NO se crean ni se promueven desde aquí (solo en la base de datos).
 */
@Component({
  selector: 'app-usuarios',
  host: { style: '--modulo: var(--c-admin)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">admin_panel_settings</span>Usuarios</h1>
          <p>Aprueba las cuentas nuevas y asigna líderes de célula (podrán registrar los ingresos de su célula). Los administradores solo se crean directamente en la base de datos.</p>
        </div>
      </div>

      <div class="chips">
        @for (f of filtrosEstado; track f.valor) {
          <button type="button" class="chip" [class.activo]="filtro() === f.valor" (click)="filtro.set(f.valor)">
            {{ f.etiqueta }}<span class="num">{{ conteo()[f.valor] ?? 0 }}</span>
          </button>
        }
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else if (!filtrados().length) {
        <div class="tarjeta vacio-estado"><span class="icono">person_off</span>No hay usuarios en esta categoría.</div>
      } @else {
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Líder de célula</th><th>Acceso con</th><th>Último acceso</th><th></th></tr>
            </thead>
            <tbody>
              @for (u of filtrados(); track u.id) {
                <tr>
                  <td class="principal" data-label="Nombre">{{ u.nombre }}</td>
                  <td data-label="Correo">{{ u.email }}</td>
                  <td data-label="Rol"><span class="insignia" [class]="u.rol === 'admin' ? 'morado' : 'gris'">{{ u.rol === 'admin' ? 'Administrador' : 'Usuario' }}</span></td>
                  <td data-label="Estado">
                    <span class="insignia" [class]="u.estado === 'activo' ? 'verde' : u.estado === 'pendiente' ? 'ambar' : 'rojo'">{{ u.estado }}</span>
                  </td>
                  <td data-label="Líder de célula">
                    @if (u.rol !== 'admin') {
                      <select class="control" [value]="u.celulaId" (change)="asignarCelula(u, $any($event.target).value)" aria-label="Célula que lidera">
                        <option value="">— No es líder —</option>
                        @for (c of celulas(); track c.id) {
                          <option [value]="c.id" [selected]="c.id === u.celulaId">{{ c['nombre'] }}</option>
                        }
                      </select>
                    }
                  </td>
                  <td data-label="Acceso con">{{ u.proveedores.join(', ').replace('password', 'contraseña') }}</td>
                  <td data-label="Último acceso">{{ u.ultimoAcceso ? fecha(u.ultimoAcceso) : 'Nunca' }}</td>
                  <td class="acciones-celda">
                    @if (u.rol !== 'admin') {
                      @if (u.estado !== 'activo') {
                        <button class="btn btn-primario" type="button" (click)="cambiar(u, 'activo')"><span class="icono">check</span> Aprobar</button>
                      } @else {
                        <button class="btn" type="button" (click)="cambiar(u, 'inactivo')"><span class="icono">block</span> Desactivar</button>
                      }
                      <button class="btn btn-icono" type="button" (click)="eliminar(u)" aria-label="Eliminar usuario"><span class="icono rojo-texto">delete</span></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <p class="texto-2 pequeno mt">
        Si desactivas a alguien, su sesión actual sigue válida hasta que caduque el token (máx. 12 h).
      </p>
    </div>
  `,
})
export class Usuarios {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);

  readonly filtrosEstado = [
    { valor: 'pendiente', etiqueta: 'Pendientes' },
    { valor: 'activo', etiqueta: 'Activos' },
    { valor: 'inactivo', etiqueta: 'Inactivos' },
    { valor: 'todos', etiqueta: 'Todos' },
  ];
  readonly usuarios = signal<UsuarioApp[]>([]);
  readonly celulas = signal<Registro[]>([]);
  readonly cargando = signal(true);
  readonly filtro = signal('pendiente');

  readonly conteo = computed(() => {
    const c: Record<string, number> = { todos: this.usuarios().length };
    for (const u of this.usuarios()) c[u.estado] = (c[u.estado] ?? 0) + 1;
    return c;
  });
  readonly filtrados = computed(() =>
    this.usuarios()
      .filter((u) => this.filtro() === 'todos' || u.estado === this.filtro())
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  );

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      const [lista, celulas] = await Promise.all([
        this.api.get<UsuarioApp[]>('usuarios'),
        this.api.listar('celulas', {}, true).catch(() => [] as Registro[]),
      ]);
      this.celulas.set([...celulas].sort((a, b) => String(a['nombre']).localeCompare(String(b['nombre']))));
      this.usuarios.set(lista);
      if (!lista.some((u) => u.estado === 'pendiente')) this.filtro.set('todos');
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  fecha(iso: string) {
    return new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  }

  async cambiar(u: UsuarioApp, estado: UsuarioApp['estado']) {
    try {
      await this.api.patch(`usuarios/${u.id}`, { estado });
      this.usuarios.update((l) => l.map((x) => (x.id === u.id ? { ...x, estado } : x)));
      this.notif.exito(estado === 'activo' ? `${u.nombre} aprobado` : `${u.nombre} desactivado`);
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  async asignarCelula(u: UsuarioApp, celulaId: string) {
    try {
      await this.api.patch(`usuarios/${u.id}`, { celulaId });
      this.usuarios.update((l) => l.map((x) => (x.id === u.id ? { ...x, celulaId } : x)));
      const celula = this.celulas().find((c) => c.id === celulaId)?.['nombre'];
      this.notif.exito(celula ? `${u.nombre} ahora es líder de ${celula}` : `${u.nombre} ya no es líder de célula`);
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  async eliminar(u: UsuarioApp) {
    if (!this.notif.confirmar(`¿Eliminar la cuenta de ${u.nombre}?`)) return;
    try {
      await this.api.borrar(`usuarios/${encodeURIComponent(u.id)}`);
      this.usuarios.update((l) => l.filter((x) => x.id !== u.id));
      this.notif.exito('Usuario eliminado');
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }
}
